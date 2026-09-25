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
   * Returns geocoded address projection fields from the explorer MV.
   */
  static selectGeocodedFields(mvAlias = 'ne'): string {
    return `
      ${mvAlias}.geocoded_address,
      ${mvAlias}.geocoded_city,
      ${mvAlias}.geocoded_state,
      ${mvAlias}.geocoded_postal_code,
      ${mvAlias}.geocoded_country,
      ${mvAlias}.geocoded_poi_name,
      ${mvAlias}.geocoded_poi_category,
      ${mvAlias}.geocoded_feature_type,
      ${mvAlias}.geocoded_provider,
      ${mvAlias}.geocoded_confidence
    `.trim();
  }

  /**
   * Returns sibling summary projection fields from the explorer MV.
   */
  static selectSiblingSummaryFields(mvAlias = 'ne'): string {
    return `
      ${mvAlias}.has_siblings,
      ${mvAlias}.sibling_count,
      ${mvAlias}.sibling_max_confidence,
      ${mvAlias}.has_strong_sibling,
      ${mvAlias}.sibling_bssids
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
   * Returns OUI device-groups join for surveillance classification.
   *
   * oui_device_groups stores colonized OUI prefixes like '70:C9:4E'.
   * BSSIDs in the Explorer are always colonized (XX:XX:XX:XX:XX:XX) because
   * the ETL normalises them on import and the MV upper-cases the bssid column.
   * SUBSTRING(bssid, 1, 8) therefore reliably extracts the colonized prefix.
   * For defensive safety we also handle un-colonized forms (12 hex chars) by
   * re-inserting colons before matching, so a raw string like 'AABBCCDDEEFF'
   * is converted to 'AA:BB:CC' before the join.
   *
   * Null / malformed BSSIDs produce no match (LEFT JOIN → NULL).
   */
  static normalizedOuiExpression(sourceBssidAlias: string): string {
    return `(
      CASE
        WHEN ${sourceBssidAlias}.bssid IS NULL THEN NULL
        WHEN ${sourceBssidAlias}.bssid ~ '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'
          THEN UPPER(SUBSTRING(${sourceBssidAlias}.bssid, 1, 8))
        WHEN ${sourceBssidAlias}.bssid ~ '^[0-9A-Fa-f]{12}$'
          THEN UPPER(
            SUBSTRING(${sourceBssidAlias}.bssid, 1, 2) || ':' ||
            SUBSTRING(${sourceBssidAlias}.bssid, 3, 2) || ':' ||
            SUBSTRING(${sourceBssidAlias}.bssid, 5, 2)
          )
        ELSE NULL
      END
    )`;
  }

  static joinOuiDeviceGroups(sourceBssidAlias: string, ouiAlias = 'odg'): string {
    return `LEFT JOIN app.oui_device_groups ${ouiAlias} ON ${ouiAlias}.oui = ${SqlFragmentLibrary.normalizedOuiExpression(sourceBssidAlias)}`;
  }

  /**
   * Returns Device Class SELECT fields using the merged
   * COALESCE(surveillance_detections.device_type, oui_device_groups.surveillance_type)
   * pattern.  The sdAlias must already be joined before calling this.
   */
  static selectDeviceClassFields(sdAlias = 'sd', ouiAlias = 'odg'): string {
    return `
      COALESCE(${sdAlias}.device_type, ${ouiAlias}.surveillance_type) AS device_class,
      ${ouiAlias}.surveillance_type AS oui_surveillance_type,
      ${ouiAlias}.surveillance_confidence AS oui_surveillance_confidence
    `.trim();
  }

  static deviceClassFilterPredicate(
    sourceBssidAlias: string,
    valuesParam: string,
    includeFalsePositiveFilter = true
  ): string {
    const falsePositiveFilter = includeFalsePositiveFilter ? 'AND sd2.false_positive = FALSE' : '';
    const noDetectionFalsePositiveFilter = includeFalsePositiveFilter
      ? 'AND sd3.false_positive = FALSE'
      : '';

    return `(EXISTS (SELECT 1 FROM app.surveillance_detections sd2
         WHERE UPPER(sd2.bssid) = UPPER(${sourceBssidAlias}.bssid)
           ${falsePositiveFilter}
           AND sd2.device_type = ANY(${valuesParam}))
       OR EXISTS (SELECT 1 FROM app.oui_device_groups odg2
         WHERE odg2.oui = ${SqlFragmentLibrary.normalizedOuiExpression(sourceBssidAlias)}
         AND odg2.surveillance_type = ANY(${valuesParam})
         AND NOT EXISTS (SELECT 1 FROM app.surveillance_detections sd3
           WHERE UPPER(sd3.bssid) = UPPER(${sourceBssidAlias}.bssid)
             ${noDetectionFalsePositiveFilter})))`;
  }

  /**
   * Returns a SQL EXISTS predicate matching non-false-positive surveillance detections
   * for either a specific set of device types or any surveillance detection.
   */
  static surveillanceDetectionPredicate(
    sourceBssidAlias: string,
    deviceTypes?: readonly string[]
  ): string {
    if (deviceTypes && deviceTypes.length > 0) {
      const inList = deviceTypes.map((t) => `'${t}'`).join(', ');
      return `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ${sourceBssidAlias}.bssid AND sd.device_type IN (${inList}) AND sd.false_positive = FALSE)`;
    }
    return `EXISTS (SELECT 1 FROM app.surveillance_detections sd WHERE sd.bssid = ${sourceBssidAlias}.bssid AND sd.false_positive = FALSE)`;
  }

  /**
   * Returns canonical join for the explorer materialized view.
   */
  static joinExplorerMv(sourceAlias: string, mvAlias = 'ne'): string {
    return `LEFT JOIN app.api_network_explorer_mv ${mvAlias} ON UPPER(${mvAlias}.bssid) = UPPER(${sourceAlias}.bssid)`;
  }

  /**
   * Returns schema-compatible observation coordinate projection with geometry fallback.
   */
  static selectObservationCoordinateFields(observationAlias = 'o'): string {
    return `
      ${FIELD_EXPRESSIONS.observationLat(observationAlias)} AS lat,
      ${FIELD_EXPRESSIONS.observationLon(observationAlias)} AS lon
    `.trim();
  }
}
