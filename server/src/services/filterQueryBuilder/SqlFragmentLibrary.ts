import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from './SchemaCompat';

/**
 * Shared SQL fragment library for query-builder composition.
 * Fragments are intentionally string-based and alias-driven so callers can
 * compose exact SQL output across query paths without changing semantics.
 */
export class SqlFragmentLibrary {
  /**
   * Returns schema-compatible manufacturer projection fields.
   */
  static selectManufacturerFields(manufacturerAlias = 'rm'): string {
    return `
      ${FIELD_EXPRESSIONS.manufacturerName(manufacturerAlias)} AS manufacturer,
      ${FIELD_EXPRESSIONS.manufacturerAddress(manufacturerAlias)} AS manufacturer_address
    `.trim();
  }

  /**
   * Returns schema-compatible network tag projection fields.
   */
  static selectThreatTagFields(tagAlias = 'nt'): string {
    return `
      ${FIELD_EXPRESSIONS.threatTag(tagAlias)} AS threat_tag,
      ${NULL_SAFE_COMPARISONS.isIgnored(tagAlias)} AS is_ignored,
      COALESCE(to_jsonb(${tagAlias})->>'all_tags', to_jsonb(${tagAlias})->>'threat_tag', to_jsonb(${tagAlias})->>'tag_type') AS all_tags
    `.trim();
  }

  /**
   * Returns lateral join that selects one tag row per BSSID.
   */
  static joinNetworkTagsLateral(sourceBssidAlias: string, lateralAlias = 'nt'): string {
    return `
      LEFT JOIN LATERAL (
        SELECT
          MAX(COALESCE(to_jsonb(nt_source)->>'threat_tag', to_jsonb(nt_source)->>'tag_type')) AS threat_tag,
          MAX(COALESCE((to_jsonb(nt_source)->>'threat_confidence')::numeric, 0)) AS threat_confidence,
          COALESCE(BOOL_OR(COALESCE((to_jsonb(nt_source)->>'is_ignored')::boolean, FALSE)), FALSE) AS is_ignored,
          STRING_AGG(
            DISTINCT LOWER(COALESCE(to_jsonb(nt_source)->>'threat_tag', to_jsonb(nt_source)->>'tag_type')),
            ',' ORDER BY LOWER(COALESCE(to_jsonb(nt_source)->>'threat_tag', to_jsonb(nt_source)->>'tag_type'))
          ) AS all_tags
        FROM app.network_tags nt_source
        WHERE UPPER(nt_source.bssid) = UPPER(${sourceBssidAlias}.bssid)
      ) ${lateralAlias} ON TRUE
    `.trim();
  }

  /**
   * Returns radio manufacturer OUI join.
   */
  static joinRadioManufacturers(sourceBssidAlias: string, manufacturerAlias = 'rm'): string {
    return `LEFT JOIN app.radio_manufacturers ${manufacturerAlias} ON ${manufacturerAlias}.oui = UPPER(REPLACE(SUBSTRING(${sourceBssidAlias}.bssid, 1, 8), ':', ''))`;
  }

  /**
   * Returns canonical observation coordinate projection with geometry fallback.
   */
  static selectObservationCoordinateFields(observationAlias = 'o'): string {
    return `
      ${FIELD_EXPRESSIONS.observationLat(observationAlias)} AS lat,
      ${FIELD_EXPRESSIONS.observationLon(observationAlias)} AS lon
    `.trim();
  }
}
