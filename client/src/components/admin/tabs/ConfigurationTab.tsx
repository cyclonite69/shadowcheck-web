import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useConfiguration } from '../hooks/useConfiguration';

const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const ShieldIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
  </svg>
);

export const ConfigurationTab: React.FC = () => {
  const {
    isLoading,
    mapboxToken,
    setMapboxToken,
    homeLocation,
    setHomeLocation,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    saveMapboxToken,
    saveHomeLocation,
    saveWigleCredentials,
  } = useConfiguration();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      <AdminCard icon={DatabaseIcon} title="Mapbox Configuration" color="from-blue-500 to-blue-600">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mapbox Token</label>
            <input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <button
            onClick={saveMapboxToken}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Token'}
          </button>
        </div>
      </AdminCard>

      <AdminCard
        icon={ShieldIcon}
        title="WiGLE Configuration"
        color="from-orange-500 to-orange-600"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">API Name</label>
            <input
              type="text"
              value={wigleApiName}
              onChange={(e) => setWigleApiName(e.target.value)}
              placeholder="AIDc40fa13..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">API Token</label>
            <input
              type="password"
              value={wigleApiToken}
              onChange={(e) => setWigleApiToken(e.target.value)}
              placeholder="32 character hex token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          <button
            onClick={saveWigleCredentials}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Credentials'}
          </button>
        </div>
      </AdminCard>

      <AdminCard icon={ShieldIcon} title="Home Location" color="from-green-500 to-green-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Latitude</label>
              <input
                type="number"
                value={homeLocation.lat}
                onChange={(e) => setHomeLocation({ ...homeLocation, lat: e.target.value })}
                placeholder="39.1031"
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Longitude</label>
              <input
                type="number"
                value={homeLocation.lng}
                onChange={(e) => setHomeLocation({ ...homeLocation, lng: e.target.value })}
                placeholder="-84.5120"
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Radius: {homeLocation.radius}m
            </label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={homeLocation.radius}
              onChange={(e) => setHomeLocation({ ...homeLocation, radius: e.target.value })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>100m</span>
              <span>5km</span>
            </div>
          </div>
          <button
            onClick={saveHomeLocation}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Location'}
          </button>
        </div>
      </AdminCard>
    </div>
  );
};
