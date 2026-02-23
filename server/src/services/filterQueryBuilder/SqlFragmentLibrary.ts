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
      COALESCE(to_jsonb(${manufacturerAlias})->>'organization_name', to_jsonb(${manufacturerAlias})->>'manufacturer', to_jsonb(${manufacturerAlias})->>'manufacturer_name') AS manufacturer,
      COALESCE(to_jsonb(${manufacturerAlias})->>'organization_address', to_jsonb(${manufacturerAlias})->>'address') AS manufacturer_address
    `.trim();
  }

  /**
   * Returns schema-compatible network tag projection fields.
   */
  static selectThreatTagFields(tagAlias = 'nt'): string {
    return `
      COALESCE(to_jsonb(${tagAlias})->>'threat_tag', to_jsonb(${tagAlias})->>'tag_type') AS threat_tag,
      COALESCE((to_jsonb(${tagAlias})->>'is_ignored')::boolean, FALSE) AS is_ignored
    `.trim();
  }

  /**
   * Returns lateral join that selects one tag row per BSSID.
   */
  static joinNetworkTagsLateral(sourceBssidAlias: string, lateralAlias = 'nt'): string {
    return `
      LEFT JOIN LATERAL (
        SELECT *
        FROM app.network_tags nt_source
        WHERE UPPER(nt_source.bssid) = UPPER(${sourceBssidAlias}.bssid)
        LIMIT 1
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
      COALESCE(${observationAlias}.lat, ST_Y(${observationAlias}.geom::geometry)) AS lat,
      COALESCE(${observationAlias}.lon, ST_X(${observationAlias}.geom::geometry)) AS lon
    `.trim();
  }
}
