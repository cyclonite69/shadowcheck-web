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
          COALESCE(
            MAX(
              CASE
                WHEN (to_jsonb(nt_source)->>'threat_confidence') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (to_jsonb(nt_source)->>'threat_confidence')::numeric
                ELSE NULL
              END
            ),
            0
          ) AS threat_confidence,
          COALESCE(BOOL_OR(COALESCE((to_jsonb(nt_source)->>'is_ignored')::boolean, FALSE)), FALSE) AS is_ignored,
          STRING_AGG(DISTINCT tag_values.tag, ',' ORDER BY tag_values.tag) AS all_tags
        FROM app.network_tags nt_source
        LEFT JOIN LATERAL (
          SELECT LOWER(COALESCE(to_jsonb(nt_source)->>'threat_tag', to_jsonb(nt_source)->>'tag_type')) AS tag
          UNION ALL
          SELECT LOWER(tag_item.tag) AS tag
          FROM jsonb_array_elements_text(COALESCE(to_jsonb(nt_source.tags), '[]'::jsonb)) AS tag_item(tag)
          UNION ALL
          SELECT 'ignore' AS tag
          WHERE COALESCE((to_jsonb(nt_source)->>'is_ignored')::boolean, FALSE)
        ) tag_values ON TRUE
        WHERE UPPER(nt_source.bssid) = UPPER(${sourceBssidAlias}.bssid)
      ) ${lateralAlias} ON TRUE
    `.trim();
  }

  /**
   * Returns LEFT JOIN for app.network_locations (centroid / weighted_centroid modes).
   * When locationMode is latest_observation (default) returns empty string — no join needed.
   */
  static joinNetworkLocations(
    sourceBssidAlias: string,
    locationMode: string,
    locAlias = 'nl'
  ): string {
    if (locationMode === 'latest_observation') {
      return '';
    }
    return `LEFT JOIN app.network_locations ${locAlias} ON UPPER(${locAlias}.bssid) = UPPER(${sourceBssidAlias}.bssid)`;
  }

  /**
   * Returns the lat/lon SELECT expressions for the given locationMode.
   * Falls back to ne.lat/ne.lon for latest_observation (MV best-observation coords).
   */
  static selectLocationCoords(mvAlias: string, locationMode: string, locAlias = 'nl'): string {
    if (locationMode === 'centroid') {
      return `COALESCE(${locAlias}.centroid_lat, ${mvAlias}.lat) AS lat,
      COALESCE(${locAlias}.centroid_lon, ${mvAlias}.lon) AS lon`;
    }
    if (locationMode === 'weighted_centroid') {
      return `COALESCE(${locAlias}.weighted_lat, ${mvAlias}.lat) AS lat,
      COALESCE(${locAlias}.weighted_lon, ${mvAlias}.lon) AS lon`;
    }
    return `${mvAlias}.lat, ${mvAlias}.lon`;
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
