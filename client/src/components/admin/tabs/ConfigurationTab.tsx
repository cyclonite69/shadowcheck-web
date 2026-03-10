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

interface SavedValueInputProps {
  actualValue: string;
  savedValue: string;
  onChange: (value: string) => void;
  sensitive?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: string;
  min?: string;
  placeholder?: string;
  className: string;
}

const maskSavedValue = (value: string, sensitive: boolean) => {
  if (!value) return '';
  if (!sensitive) return value;
  return `${value.slice(0, 6)}...`;
};

const SavedValueInput: React.FC<SavedValueInputProps> = ({
  actualValue,
  savedValue,
  onChange,
  sensitive = false,
  inputMode,
  step,
  min,
  placeholder,
  className,
}) => {
  const [focused, setFocused] = React.useState(false);
  const isDirty = actualValue !== savedValue;
  const isEditing = focused || isDirty;
  const hasSavedValue = savedValue.length > 0;
  const displayValue =
    isEditing || !hasSavedValue ? actualValue : maskSavedValue(savedValue, sensitive);

  return (
    <input
      type="text"
      inputMode={inputMode}
      step={step}
      min={min}
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={!hasSavedValue ? placeholder : undefined}
      className={`${className} ${!isEditing && hasSavedValue ? 'text-slate-400' : 'text-white'}`}
    />
  );
};

export const ConfigurationTab: React.FC = () => {
  const {
    isLoading,
    mapboxToken,
    setMapboxToken,
    mapboxUnlimitedApiKey,
    setMapboxUnlimitedApiKey,
    googleMapsApiKey,
    setGoogleMapsApiKey,
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
    mapboxUnlimitedConfigured,
    googleMapsConfigured,
    wigleConfigured,
    awsConfigured,
    opencageConfigured,
    locationIqConfigured,
    smartyConfigured,
    homeLocation,
    setHomeLocation,
    savedValues,
    homeLocationLoading,
    homeLocationError,
    homeLocationConfigured,
    homeLocationLastUpdated,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    saveMapboxToken,
    saveMapboxUnlimitedApiKey,
    saveGoogleMapsApiKey,
    saveAwsRegion,
    saveOpencageApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveHomeLocation,
    saveWigleCredentials,
  } = useConfiguration();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Mapbox */}
      <AdminCard icon={DatabaseIcon} title="Mapbox Configuration" color="from-blue-500 to-blue-600">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Token
            </label>
            <SavedValueInput
              actualValue={mapboxToken}
              savedValue={savedValues.mapboxToken}
              onChange={setMapboxToken}
              sensitive
              placeholder="pk.eyJ1..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  mapboxConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                }`}
              >
                {mapboxConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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

      {/* Mapbox Geocoding (Unlimited) */}
      <AdminCard icon={DatabaseIcon} title="Mapbox Geocoding Key" color="from-sky-500 to-sky-600">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Key
            </label>
            <SavedValueInput
              actualValue={mapboxUnlimitedApiKey}
              savedValue={savedValues.mapboxUnlimitedApiKey}
              onChange={setMapboxUnlimitedApiKey}
              sensitive
              placeholder="sk."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  mapboxUnlimitedConfigured
                    ? 'bg-green-900/40 text-green-300'
                    : 'bg-red-900/40 text-red-300'
                }`}
              >
                {mapboxUnlimitedConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
            </div>
          </div>
          <button
            onClick={saveMapboxUnlimitedApiKey}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg font-medium hover:from-sky-500 hover:to-sky-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save Geocoding Key'}
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
            <SavedValueInput
              actualValue={googleMapsApiKey}
              savedValue={savedValues.googleMapsApiKey}
              onChange={setGoogleMapsApiKey}
              sensitive
              placeholder="AIzaSy..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  googleMapsConfigured
                    ? 'bg-green-900/40 text-green-300'
                    : 'bg-red-900/40 text-red-300'
                }`}
              >
                {googleMapsConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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
              Region
            </label>
            <SavedValueInput
              actualValue={awsRegion}
              savedValue={savedValues.awsRegion}
              onChange={setAwsRegion}
              placeholder="us-east-1"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  awsConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                }`}
              >
                {awsConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Credentials are resolved from the runtime provider chain (IAM role, STS, SSO). Static
              access keys are intentionally disabled.
            </p>
          </div>
          <button
            onClick={saveAwsRegion}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg font-medium hover:from-cyan-500 hover:to-cyan-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Save AWS Region'}
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
            <SavedValueInput
              actualValue={opencageApiKey}
              savedValue={savedValues.opencageApiKey}
              onChange={setOpencageApiKey}
              sensitive
              placeholder="opencage..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  opencageConfigured
                    ? 'bg-green-900/40 text-green-300'
                    : 'bg-red-900/40 text-red-300'
                }`}
              >
                {opencageConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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
            <SavedValueInput
              actualValue={locationIqApiKey}
              savedValue={savedValues.locationIqApiKey}
              onChange={setLocationIqApiKey}
              sensitive
              placeholder="locationiq..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  locationIqConfigured
                    ? 'bg-green-900/40 text-green-300'
                    : 'bg-red-900/40 text-red-300'
                }`}
              >
                {locationIqConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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
            <SavedValueInput
              actualValue={smartyAuthId}
              savedValue={savedValues.smartyAuthId}
              onChange={setSmartyAuthId}
              sensitive
              placeholder="auth-id"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Auth Token
            </label>
            <SavedValueInput
              actualValue={smartyAuthToken}
              savedValue={savedValues.smartyAuthToken}
              onChange={setSmartyAuthToken}
              sensitive
              placeholder="auth-token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  smartyConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                }`}
              >
                {smartyConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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
            <SavedValueInput
              actualValue={wigleApiName}
              savedValue={savedValues.wigleApiName}
              onChange={setWigleApiName}
              placeholder="AIDc40fa13..."
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              API Token
            </label>
            <SavedValueInput
              actualValue={wigleApiToken}
              savedValue={savedValues.wigleApiToken}
              onChange={setWigleApiToken}
              sensitive
              placeholder="32 character hex token"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
            <div className="mt-2 text-xs text-slate-400">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  wigleConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                }`}
              >
                {wigleConfigured ? '✓ Configured' : '✗ Not Configured'}
              </span>
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
          <div className="text-xs text-slate-400">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                homeLocationConfigured
                  ? 'bg-green-900/40 text-green-300'
                  : 'bg-red-900/40 text-red-300'
              }`}
            >
              {homeLocationConfigured ? '✓ Configured' : '✗ Not Configured'}
            </span>
            {homeLocationLastUpdated && (
              <p className="mt-2 text-slate-400">
                Last updated: {new Date(homeLocationLastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Latitude
            </label>
            <SavedValueInput
              actualValue={homeLocation.lat}
              savedValue={savedValues.homeLocation.lat}
              onChange={(value) => setHomeLocation({ ...homeLocation, lat: value })}
              inputMode="decimal"
              step="any"
              placeholder="39.1031"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Longitude
            </label>
            <SavedValueInput
              actualValue={homeLocation.lng}
              savedValue={savedValues.homeLocation.lng}
              onChange={(value) => setHomeLocation({ ...homeLocation, lng: value })}
              inputMode="decimal"
              step="any"
              placeholder="-84.5120"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Radius (meters)
            </label>
            <SavedValueInput
              actualValue={homeLocation.radius}
              savedValue={savedValues.homeLocation.radius}
              onChange={(value) => setHomeLocation({ ...homeLocation, radius: value })}
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="500"
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
            />
          </div>
          {homeLocationLoading && (
            <p className="text-xs text-slate-400">Loading current location...</p>
          )}
          {!homeLocationLoading && homeLocationError && (
            <p className="text-xs text-red-300 bg-red-900/20 border border-red-700/30 rounded-md px-2 py-1">
              {homeLocationError}
            </p>
          )}
          <button
            onClick={saveHomeLocation}
            disabled={isLoading || homeLocationLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Saving...' : 'Update Home Location'}
          </button>
        </div>
      </AdminCard>
    </div>
  );
};
