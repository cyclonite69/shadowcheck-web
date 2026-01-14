// Data quality filters for observations
const DATA_QUALITY_FILTERS = {
  // Exclude temporal clusters (batch imports with >50 obs at same time/location)
  temporal_clusters: `
    AND (time, lat, lon) NOT IN (
      SELECT time, lat, lon FROM observations 
      GROUP BY time, lat, lon HAVING COUNT(*) > 50
    )
  `,

  // Exclude extreme signal levels (outside typical WiFi range)
  extreme_signals: `
    AND level BETWEEN -120 AND 0
  `,

  // Exclude duplicate coordinates (>1000 obs at same location)
  duplicate_coords: `
    AND (lat, lon) NOT IN (
      SELECT lat, lon FROM observations 
      GROUP BY lat, lon HAVING COUNT(*) > 1000
    )
  `,

  // Combined filter (all quality issues)
  all: function () {
    return this.temporal_clusters + this.extreme_signals + this.duplicate_coords;
  },
};

module.exports = { DATA_QUALITY_FILTERS };
