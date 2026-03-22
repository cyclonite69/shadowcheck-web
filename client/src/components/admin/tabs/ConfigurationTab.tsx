import React from 'react';
import { useConfiguration } from '../hooks/useConfiguration';
import { MapboxConfig } from './config/MapboxConfig';
import { AWSConfig } from './config/AWSConfig';
import { GeocodingConfig } from './config/GeocodingConfig';
import { GoogleMapsConfig } from './config/GoogleMapsConfig';
import { HomeLocationConfig } from './config/HomeLocationConfig';
import { AdminCard } from '../components/AdminCard';
import { SavedValueInput } from './config/SavedValueInput';

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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const RadioIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

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
    geocodioApiKey,
    setGeocodioApiKey,
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
    geocodioConfigured,
    locationIqConfigured,
    smartyConfigured,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    homeLocation,
    setHomeLocation,
    savedValues,
    homeLocationConfigured,
    saveMapboxToken,
    saveMapboxUnlimitedApiKey,
    saveWigleCredentials,
    saveAwsRegion,
    saveGoogleMapsApiKey,
    saveOpencageApiKey,
    saveGeocodioApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveHomeLocation,
  } = useConfiguration();

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Home Location - Top Left Priority */}
        <HomeLocationConfig
          lat={homeLocation.lat}
          lng={homeLocation.lng}
          radius={homeLocation.radius}
          setHomeLocation={setHomeLocation}
          isSaving={isLoading}
          onSave={saveHomeLocation}
          hasChanges={
            homeLocation.lat !== savedValues.homeLocation.lat ||
            homeLocation.lng !== savedValues.homeLocation.lng ||
            homeLocation.radius !== savedValues.homeLocation.radius
          }
          isLoading={isLoading}
          isConfigured={homeLocationConfigured}
        />

        {/* Mapbox */}
        <MapboxConfig
          mapboxToken={mapboxToken}
          setMapboxToken={setMapboxToken}
          savedMapboxToken={savedValues.mapboxToken}
          mapboxUnlimitedApiKey={mapboxUnlimitedApiKey}
          setMapboxUnlimitedApiKey={setMapboxUnlimitedApiKey}
          savedMapboxUnlimitedApiKey={savedValues.mapboxUnlimitedApiKey}
          isSaving={isLoading}
          onSave={saveMapboxToken}
          hasChanges={
            mapboxToken !== savedValues.mapboxToken ||
            mapboxUnlimitedApiKey !== savedValues.mapboxUnlimitedApiKey
          }
          isConfigured={mapboxConfigured || mapboxUnlimitedConfigured}
        />

        {/* WiGLE */}
        <AdminCard
          title="WiGLE Configuration"
          icon={RadioIcon}
          color="from-cyan-600 to-blue-600"
          isConfigured={wigleConfigured}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">API Name</label>
              <SavedValueInput
                actualValue={wigleApiName}
                savedValue={savedValues.wigleApiName}
                onChange={setWigleApiName}
                placeholder="AID..."
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">API Token</label>
              <SavedValueInput
                actualValue={wigleApiToken}
                savedValue={savedValues.wigleApiToken}
                onChange={setWigleApiToken}
                sensitive={true}
                placeholder="Token"
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
            <button
              onClick={saveWigleCredentials}
              disabled={
                isLoading ||
                (wigleApiName === savedValues.wigleApiName &&
                  wigleApiToken === savedValues.wigleApiToken)
              }
              className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                wigleApiName !== savedValues.wigleApiName ||
                wigleApiToken !== savedValues.wigleApiToken
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save WiGLE Settings'}
            </button>
          </div>
        </AdminCard>

        {/* AWS */}
        <AWSConfig
          awsRegion={awsRegion}
          setAwsRegion={setAwsRegion}
          savedAwsRegion={savedValues.awsRegion}
          awsAccessKeyId=""
          setAwsAccessKeyId={() => {}}
          savedAwsAccessKeyId=""
          awsSecretAccessKey=""
          setAwsSecretAccessKey={() => {}}
          savedAwsSecretAccessKey=""
          isSaving={isLoading}
          onSave={saveAwsRegion}
          hasChanges={awsRegion !== savedValues.awsRegion}
          isConfigured={awsConfigured}
        />

        {/* Geocoding */}
        <GeocodingConfig
          opencageApiKey={opencageApiKey}
          setOpencageApiKey={setOpencageApiKey}
          savedOpencageApiKey={savedValues.opencageApiKey}
          geocodioApiKey={geocodioApiKey}
          setGeocodioApiKey={setGeocodioApiKey}
          savedGeocodioApiKey={savedValues.geocodioApiKey}
          locationIqApiKey={locationIqApiKey}
          setLocationIqApiKey={setLocationIqApiKey}
          savedLocationIqApiKey={savedValues.locationIqApiKey}
          isSaving={isLoading}
          onSave={() => {
            if (opencageApiKey !== savedValues.opencageApiKey) saveOpencageApiKey();
            if (geocodioApiKey !== savedValues.geocodioApiKey) saveGeocodioApiKey();
            if (locationIqApiKey !== savedValues.locationIqApiKey) saveLocationIqApiKey();
          }}
          hasChanges={
            opencageApiKey !== savedValues.opencageApiKey ||
            geocodioApiKey !== savedValues.geocodioApiKey ||
            locationIqApiKey !== savedValues.locationIqApiKey
          }
          isConfigured={opencageConfigured || geocodioConfigured || locationIqConfigured}
        />

        {/* Google Maps */}
        <GoogleMapsConfig
          googleMapsApiKey={googleMapsApiKey}
          setGoogleMapsApiKey={setGoogleMapsApiKey}
          savedGoogleMapsApiKey={savedValues.googleMapsApiKey}
          isSaving={isLoading}
          onSave={saveGoogleMapsApiKey}
          hasChanges={googleMapsApiKey !== savedValues.googleMapsApiKey}
          isConfigured={googleMapsConfigured}
        />

        {/* Smarty */}
        <AdminCard
          title="Smarty Configuration"
          icon={ShieldIcon}
          color="from-indigo-600 to-violet-600"
          isConfigured={smartyConfigured}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Auth ID</label>
              <SavedValueInput
                actualValue={smartyAuthId}
                savedValue={savedValues.smartyAuthId}
                onChange={setSmartyAuthId}
                placeholder="ID"
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Auth Token</label>
              <SavedValueInput
                actualValue={smartyAuthToken}
                savedValue={savedValues.smartyAuthToken}
                onChange={setSmartyAuthToken}
                sensitive={true}
                placeholder="Token"
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <button
              onClick={saveSmartyCredentials}
              disabled={
                isLoading ||
                (smartyAuthId === savedValues.smartyAuthId &&
                  smartyAuthToken === savedValues.smartyAuthToken)
              }
              className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                smartyAuthId !== savedValues.smartyAuthId ||
                smartyAuthToken !== savedValues.smartyAuthToken
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save Smarty Settings'}
            </button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
