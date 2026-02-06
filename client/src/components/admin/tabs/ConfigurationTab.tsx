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
    googleMapsApiKey,
    setGoogleMapsApiKey,
    awsAccessKeyId,
    setAwsAccessKeyId,
    awsSecretAccessKey,
    setAwsSecretAccessKey,
    awsSessionToken,
    setAwsSessionToken,
    awsRegion,
    setAwsRegion,
    opencageApiKey,
    setOpencageApiKey,
    locationIqApiKey,
    setLocationIqApiKey,
    smartyAuthId,
    setSmartyAuthId,
    smartyAuthToken,
    setSmartyAuthToken,
    mapboxConfigured,
    googleMapsConfigured,
    wigleConfigured,
    awsConfigured,
    opencageConfigured,
    locationIqConfigured,
    smartyConfigured,
    homeLocation,
    setHomeLocation,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    saveMapboxToken,
    saveGoogleMapsApiKey,
    saveAwsCredentials,
    saveOpencageApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveHomeLocation,
    saveWigleCredentials,
  } = useConfiguration();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {/* Mapbox */}
      <AdminCard icon={DatabaseIcon} title="Mapbox Configuration" color="from-blue-500 to-blue-600">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Token
            </label>
            <input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {mapboxConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveMapboxToken}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save Token'}
          </button>
        </div>
      </AdminCard>

      {/* Google Maps */}
      <AdminCard
        icon={DatabaseIcon}
        title="Google Maps Configuration"
        color="from-emerald-500 to-emerald-600"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="text"
              value={googleMapsApiKey}
              onChange={(e) => setGoogleMapsApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {googleMapsConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveGoogleMapsApiKey}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-medium hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </AdminCard>

      {/* AWS */}
      <AdminCard icon={DatabaseIcon} title="AWS Configuration" color="from-cyan-500 to-cyan-600">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Access Key ID
            </label>
            <input
              type="text"
              value={awsAccessKeyId}
              onChange={(e) => setAwsAccessKeyId(e.target.value)}
              placeholder="AKIA..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Secret Access Key
            </label>
            <input
              type="password"
              value={awsSecretAccessKey}
              onChange={(e) => setAwsSecretAccessKey(e.target.value)}
              placeholder="secret"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Session Token (Optional)
            </label>
            <input
              type="password"
              value={awsSessionToken}
              onChange={(e) => setAwsSessionToken(e.target.value)}
              placeholder="token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Region
            </label>
            <input
              type="text"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              placeholder="us-east-1"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {awsConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveAwsCredentials}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg font-medium hover:from-cyan-500 hover:to-cyan-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save AWS Credentials'}
          </button>
        </div>
      </AdminCard>

      {/* OpenCage */}
      <AdminCard
        icon={DatabaseIcon}
        title="OpenCage Configuration"
        color="from-indigo-500 to-indigo-600"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={opencageApiKey}
              onChange={(e) => setOpencageApiKey(e.target.value)}
              placeholder="opencage..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {opencageConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveOpencageApiKey}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:from-indigo-500 hover:to-indigo-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </AdminCard>

      {/* LocationIQ */}
      <AdminCard
        icon={DatabaseIcon}
        title="LocationIQ Configuration"
        color="from-teal-500 to-teal-600"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={locationIqApiKey}
              onChange={(e) => setLocationIqApiKey(e.target.value)}
              placeholder="locationiq..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {locationIqConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveLocationIqApiKey}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-medium hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </AdminCard>

      {/* Smarty */}
      <AdminCard icon={ShieldIcon} title="Smarty Configuration" color="from-rose-500 to-rose-600">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Auth ID
            </label>
            <input
              type="password"
              value={smartyAuthId}
              onChange={(e) => setSmartyAuthId(e.target.value)}
              placeholder="auth-id"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Auth Token
            </label>
            <input
              type="password"
              value={smartyAuthToken}
              onChange={(e) => setSmartyAuthToken(e.target.value)}
              placeholder="auth-token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {smartyConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveSmartyCredentials}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg font-medium hover:from-rose-500 hover:to-rose-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save Credentials'}
          </button>
        </div>
      </AdminCard>

      {/* WiGLE Credentials */}
      <AdminCard
        icon={ShieldIcon}
        title="WiGLE Configuration"
        color="from-orange-500 to-orange-600"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Name
            </label>
            <input
              type="text"
              value={wigleApiName}
              onChange={(e) => setWigleApiName(e.target.value)}
              placeholder="AIDc40fa13..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Token
            </label>
            <input
              type="password"
              value={wigleApiToken}
              onChange={(e) => setWigleApiToken(e.target.value)}
              placeholder="32 character hex token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              Status: {wigleConfigured ? 'Configured' : 'Not configured'}
            </div>
          </div>
          <button
            onClick={saveWigleCredentials}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg font-medium hover:from-orange-500 hover:to-orange-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save Credentials'}
          </button>
        </div>
      </AdminCard>

      {/* Home Location */}
      <AdminCard icon={ShieldIcon} title="Home Location" color="from-green-500 to-green-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Latitude
              </label>
              <input
                type="number"
                value={homeLocation.lat}
                onChange={(e) => setHomeLocation({ ...homeLocation, lat: e.target.value })}
                placeholder="39.1031"
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Longitude
              </label>
              <input
                type="number"
                value={homeLocation.lng}
                onChange={(e) => setHomeLocation({ ...homeLocation, lng: e.target.value })}
                placeholder="-84.5120"
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Radius: {homeLocation.radius}m
            </label>
            <input
              type="range"
              min="10"
              max="5000"
              step="10"
              value={homeLocation.radius}
              onChange={(e) => setHomeLocation({ ...homeLocation, radius: e.target.value })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>10m</span>
              <span>5km</span>
            </div>
          </div>
          <button
            onClick={saveHomeLocation}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save Location'}
          </button>
        </div>
      </AdminCard>
    </div>
  );
};
