import React from 'react';
import { useConfiguration } from '../hooks/useConfiguration';
import { MapboxConfig } from './config/MapboxConfig';
import { AWSConfig } from './config/AWSConfig';
import { GeocodingConfig } from './config/GeocodingConfig';
import { GoogleMapsConfig } from './config/GoogleMapsConfig';
import { HomeLocationConfig } from './config/HomeLocationConfig';
import { WigleConfig } from './config/WigleConfig';
import { SmartyConfig } from './config/SmartyConfig';
import { AdminCard } from '../components/AdminCard';

const ToggleIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2" y="7" width="20" height="10" rx="5" />
    <circle cx="16" cy="12" r="3" />
  </svg>
);

const ServerIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="4" width="18" height="6" rx="1" />
    <rect x="3" y="14" width="18" height="6" rx="1" />
    <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
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
    runtimeConfig,
    homeLocationConfigured,
    saveMapboxToken,
    saveWigleCredentials,
    saveAwsRegion,
    saveGoogleMapsApiKey,
    saveOpencageApiKey,
    saveGeocodioApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveHomeLocation,
  } = useConfiguration();
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';
  const featureFlags = runtimeConfig?.featureFlags;
  const runtime = runtimeConfig?.runtime;
  const featureItems = [
    {
      label: 'Demo Mode',
      enabled: demoMode,
      detail: 'VITE_DEMO_MODE',
      source: 'Frontend build flag',
    },
    {
      label: 'Docker Controls',
      enabled: featureFlags?.adminAllowDocker ?? false,
      detail: 'ADMIN_ALLOW_DOCKER',
      source: 'Restart required',
    },
    {
      label: 'ML Training',
      enabled: featureFlags?.adminAllowMlTraining ?? true,
      detail: 'ADMIN_ALLOW_ML_TRAINING',
      source: 'Restart required',
    },
    {
      label: 'ML Scoring',
      enabled: featureFlags?.adminAllowMlScoring ?? true,
      detail: 'ADMIN_ALLOW_ML_SCORING',
      source: 'Restart required',
    },
    {
      label: 'Background Jobs',
      enabled: featureFlags?.enableBackgroundJobs ?? false,
      detail: 'ENABLE_BACKGROUND_JOBS',
      source: 'Restart required',
    },
    {
      label: 'API Gate',
      enabled: featureFlags?.apiGateEnabled ?? true,
      detail: 'API_GATE_ENABLED',
      source: 'Restart required',
    },
    {
      label: 'Force HTTPS',
      enabled: featureFlags?.forceHttps ?? false,
      detail: 'FORCE_HTTPS',
      source: 'Restart required',
    },
    {
      label: 'Cookie Secure',
      enabled: featureFlags?.cookieSecure ?? false,
      detail: 'COOKIE_SECURE',
      source: 'Restart required',
    },
    {
      label: 'Simple Rule Scoring',
      enabled: featureFlags?.simpleRuleScoringEnabled ?? false,
      detail: 'SIMPLE_RULE_SCORING_ENABLED',
      source: 'Restart required',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminCard
          icon={ToggleIcon}
          title="Feature Flags (Read-Only)"
          color="from-cyan-500 to-blue-600"
        >
          <div className="space-y-3">
            {featureItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.detail}</div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${
                      item.enabled
                        ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-300'
                        : 'border-slate-700/50 bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    {item.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{item.source}</div>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              These are status indicators only. They reflect frontend build flags and API runtime
              environment flags. They are not editable from the admin UI.
            </div>
          </div>
        </AdminCard>

        <AdminCard icon={ServerIcon} title="Runtime Status" color="from-violet-500 to-fuchsia-600">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Environment</span>
              <span className="text-white">{runtime?.nodeEnv || 'unknown'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Log level</span>
              <span className="text-white">{runtime?.logLevel || 'unknown'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">ML model version</span>
              <span className="font-mono text-slate-200">{runtime?.mlModelVersion || 'n/a'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">ML score limit</span>
              <span className="text-slate-200">{runtime?.mlScoreLimit ?? 'n/a'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">ML auto-score limit</span>
              <span className="text-slate-200">{runtime?.mlAutoScoreLimit ?? 'n/a'}</span>
            </div>
            <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
              Environment-backed flags shown here are read-only and usually require an API restart
              after changes.
            </div>
          </div>
        </AdminCard>

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
        <WigleConfig
          wigleApiName={wigleApiName}
          setWigleApiName={setWigleApiName}
          savedWigleApiName={savedValues.wigleApiName}
          wigleApiToken={wigleApiToken}
          setWigleApiToken={setWigleApiToken}
          savedWigleApiToken={savedValues.wigleApiToken}
          isSaving={isLoading}
          onSave={saveWigleCredentials}
          isConfigured={wigleConfigured}
        />

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
        <SmartyConfig
          smartyAuthId={smartyAuthId}
          setSmartyAuthId={setSmartyAuthId}
          savedSmartyAuthId={savedValues.smartyAuthId}
          smartyAuthToken={smartyAuthToken}
          setSmartyAuthToken={setSmartyAuthToken}
          savedSmartyAuthToken={savedValues.smartyAuthToken}
          isSaving={isLoading}
          onSave={saveSmartyCredentials}
          isConfigured={smartyConfigured}
        />
      </div>
    </div>
  );
};
