/**
 * Universal Filter System - Usage Examples
 *
 * This demonstrates how to use the universal filter system across
 * different components and pages in ShadowCheck.
 */

import React from 'react';
import { FilterPanel } from '../components/FilterPanel';
import {
  useFilteredNetworks,
  useFilteredGeospatial,
  useFilterURLSync,
} from '../hooks/useFilteredData';
import { useFilterStore } from '../stores/filterStore';

// Example 1: Network Explorer with Filters
export const NetworkExplorerPage: React.FC = () => {
  useFilterURLSync(); // Sync filters with URL

  const {
    data: networks,
    loading,
    error,
    hasMore,
    loadMore,
  } = useFilteredNetworks({
    limit: 100,
    sort: 'threat_score',
    order: 'desc',
  });

  return (
    <div className="flex h-screen">
      <FilterPanel />
      <div className="flex-1 p-4">
        <h1>Network Explorer</h1>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-500">Error: {error}</div>}

        <div className="grid gap-4">
          {networks.map((network) => (
            <div key={network.bssid} className="p-4 border rounded">
              <div className="font-mono">{network.bssid}</div>
              <div>{network.ssid || '(hidden)'}</div>
              <div>Threat Score: {network.ml_threat_score || 0}</div>
            </div>
          ))}
        </div>

        {hasMore && (
          <button onClick={loadMore} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Load More
          </button>
        )}
      </div>
    </div>
  );
};

// Example 2: Geospatial Map with Filters
export const GeospatialMapPage: React.FC = () => {
  useFilterURLSync();

  const { data: geoData, loading } = useFilteredGeospatial({
    limit: 5000,
  });

  // Transform to Mapbox format
  const geojson = {
    type: 'FeatureCollection' as const,
    features: geoData,
  };

  return (
    <div className="flex h-screen">
      <FilterPanel />
      <div className="flex-1">
        {loading && <div className="absolute top-4 right-4 z-10">Loading map data...</div>}
        {/* Your Mapbox component here */}
        <MapboxMap geojson={geojson} />
      </div>
    </div>
  );
};

// Example 3: Threat Dashboard with Filters
export const ThreatDashboardPage: React.FC = () => {
  const { setFilter, enableFilter } = useFilterStore();

  // Pre-configure for threat analysis
  React.useEffect(() => {
    setFilter('threatScoreMin', 40);
    setFilter('radioTypes', ['W']); // WiFi only
    setFilter('timeframe', { type: 'relative', relativeWindow: '7d' });
    enableFilter('threatScoreMin', true);
    enableFilter('radioTypes', true);
  }, [setFilter, enableFilter]);

  const { data: threats, loading } = useFilteredNetworks({
    sort: 'threat_score',
    order: 'desc',
  });

  return (
    <div className="flex h-screen">
      <FilterPanel />
      <div className="flex-1 p-4">
        <h1>Threat Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {threats.map((threat) => (
            <div
              key={threat.bssid}
              className={`p-4 border rounded ${
                threat.ml_threat_score >= 80
                  ? 'border-red-500 bg-red-50'
                  : threat.ml_threat_score >= 60
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="font-mono text-sm">{threat.bssid}</div>
              <div className="font-semibold">{threat.ssid || '(hidden)'}</div>
              <div className="text-lg font-bold">Score: {threat.ml_threat_score || 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Example API Requests:

/*
// 1. Get WiFi networks with high threat scores from last 7 days
GET /api/v2/networks/filtered?filters={
  "radioTypes": ["W"],
  "threatScoreMin": 60,
  "timeframe": {
    "type": "relative",
    "relativeWindow": "7d"
  }
}

// 2. Get geospatial data for networks near home location
GET /api/v2/networks/filtered/geospatial?filters={
  "distanceFromHomeMax": 5000,
  "excludeInvalidCoords": true,
  "gpsAccuracyMax": 50
}

// 3. Get open WiFi networks with multiple observations
GET /api/v2/networks/filtered?filters={
  "radioTypes": ["W"],
  "encryptionTypes": ["OPEN"],
  "observationCountMin": 5
}

// 4. Get analytics for networks in bounding box
GET /api/v2/networks/filtered/analytics?filters={
  "boundingBox": {
    "north": 40.7829,
    "south": 40.7489,
    "east": -73.9441,
    "west": -73.9927
  }
}
*/

// Dummy MapboxMap component for example
const MapboxMap: React.FC<{ geojson: any }> = ({ geojson }) => (
  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
    Map with {geojson.features.length} points
  </div>
);
