import React from 'react';
import { adminApi } from '../../../api/adminApi';
import { useConfiguration } from '../hooks/useConfiguration';
import { MapboxConfig } from './config/MapboxConfig';
import { AWSConfig } from './config/AWSConfig';
import { GeocodingConfig } from './config/GeocodingConfig';
import { GoogleMapsConfig } from './config/GoogleMapsConfig';
import { HomeLocationConfig } from './config/HomeLocationConfig';
import { WigleConfig } from './config/WigleConfig';
import { SmartyConfig } from './config/SmartyConfig';
import { AdminCard } from '../components/AdminCard';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const BrainIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const ChevronIcon = ({ open, size = 16 }: { open: boolean; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="mb-4">
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
    {description && <p className="mt-0.5 text-[11px] text-slate-600">{description}</p>}
  </div>
);

interface FlagItem {
  label: string;
  enabled: boolean;
  detail: string;
  source: string;
  impact: 'Live' | 'Restart' | 'Rebuild';
  editable?: boolean;
  recommendedAction?: string;
}

const impactClassName = (impact: string) => {
  switch (impact) {
    case 'Live':
      return 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300';
    case 'Restart':
      return 'border-amber-700/50 bg-amber-900/20 text-amber-200';
    case 'Rebuild':
      return 'border-fuchsia-700/50 bg-fuchsia-900/20 text-fuchsia-200';
    default:
      return 'border-slate-700/50 bg-slate-800/60 text-slate-300';
  }
};

const FlagRow: React.FC<{
  item: FlagItem;
  isLoading: boolean;
  onToggle: (key: string, next: boolean) => void;
}> = ({ item, isLoading, onToggle }) => (
  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
    <div>
      <div className="text-sm font-medium text-white">{item.label}</div>
      <div className="text-xs text-slate-500">{item.detail}</div>
    </div>
    <div className="shrink-0 text-right">
      <div className="flex flex-wrap justify-end gap-2">
        <div
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${
            item.enabled
              ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-300'
              : 'border-slate-700/50 bg-slate-800/60 text-slate-300'
          }`}
        >
          {item.enabled ? 'Enabled' : 'Disabled'}
        </div>
        <div
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${impactClassName(item.impact)}`}
        >
          {item.impact}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{item.source}</div>
      {item.editable ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onToggle(item.detail, !item.enabled)}
          className="mt-2 rounded-md border border-blue-600/50 bg-blue-600/10 px-2 py-1 text-[11px] text-blue-200 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.enabled ? 'Disable live' : 'Enable live'}
        </button>
      ) : (
        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
          <div>
            {item.impact === 'Restart'
              ? 'Change env/secret, then recreate the container.'
              : 'Change build config, then rebuild the frontend.'}
          </div>
          {item.recommendedAction && (
            <div className="text-slate-400">Recommended: {item.recommendedAction}</div>
          )}
        </div>
      )}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

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
    updateFeatureFlag,
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

  const [stackActionLoading, setStackActionLoading] = React.useState<
    null | 'recreate-api' | 'rebuild-frontend' | 'rebuild-stack'
  >(null);
  const [stackActionMessage, setStackActionMessage] = React.useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [deployFlagsOpen, setDeployFlagsOpen] = React.useState(false);

  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';
  const featureFlags = runtimeConfig?.featureFlags;
  const runtime = runtimeConfig?.runtime;

  // Scoring mode banner
  const mlScoringOn = featureFlags?.adminAllowMlScoring ?? true;
  const simpleRuleOn = featureFlags?.simpleRuleScoringEnabled ?? false;
  let scoringMode: { label: string; className: string };
  if (mlScoringOn) {
    scoringMode = {
      label: 'Mode: ML Scoring',
      className: 'border-cyan-700/50 bg-cyan-900/20 text-cyan-300',
    };
  } else if (simpleRuleOn) {
    scoringMode = {
      label: 'Mode: Pure Rule Scoring',
      className: 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300',
    };
  } else {
    scoringMode = {
      label: 'Mode: None (no scoring active)',
      className: 'border-amber-700/50 bg-amber-900/20 text-amber-300',
    };
  }

  // Flag lists
  const operationalFlags: FlagItem[] = [
    {
      label: 'Docker Controls',
      enabled: featureFlags?.adminAllowDocker ?? false,
      detail: 'admin_allow_docker',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Background Jobs',
      enabled: featureFlags?.enableBackgroundJobs ?? false,
      detail: 'enable_background_jobs',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
  ];

  const scoringFlags: FlagItem[] = [
    {
      label: 'ML Training',
      enabled: featureFlags?.adminAllowMlTraining ?? true,
      detail: 'admin_allow_ml_training',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'ML Scoring',
      enabled: featureFlags?.adminAllowMlScoring ?? true,
      detail: 'admin_allow_ml_scoring',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Simple Rule Scoring',
      enabled: featureFlags?.simpleRuleScoringEnabled ?? false,
      detail: 'simple_rule_scoring_enabled',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Score Debug Logging',
      enabled: featureFlags?.scoreDebugLogging ?? false,
      detail: 'score_debug_logging',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Auto-Geocode on Import',
      enabled: featureFlags?.autoGeocodeOnImport ?? true,
      detail: 'auto_geocode_on_import',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Deduplicate on Scan Ingest',
      enabled: featureFlags?.dedupeOnScan ?? true,
      detail: 'dedupe_on_scan',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
  ];

  const deployFlags: FlagItem[] = [
    {
      label: 'API Gate',
      enabled: featureFlags?.apiGateEnabled ?? true,
      detail: 'API_GATE_ENABLED',
      source: 'Environment-backed',
      impact: 'Restart',
      recommendedAction: 'Recreate API',
    },
    {
      label: 'Force HTTPS',
      enabled: featureFlags?.forceHttps ?? false,
      detail: 'FORCE_HTTPS',
      source: 'Environment-backed',
      impact: 'Restart',
      recommendedAction: 'Recreate API',
    },
    {
      label: 'Cookie Secure',
      enabled: featureFlags?.cookieSecure ?? false,
      detail: 'COOKIE_SECURE',
      source: 'Environment-backed',
      impact: 'Restart',
      recommendedAction: 'Recreate API',
    },
    {
      label: 'Demo Mode',
      enabled: demoMode,
      detail: 'VITE_DEMO_MODE',
      source: 'Frontend build flag',
      impact: 'Rebuild',
      recommendedAction: 'Rebuild Frontend',
    },
  ];

  const runLocalStackAction = async (
    action: 'recreate-api' | 'rebuild-frontend' | 'rebuild-stack'
  ) => {
    const confirmationText: Record<typeof action, string> = {
      'recreate-api':
        'Recreate the API container now? Use this after changing deploy-time settings or secrets.',
      'rebuild-frontend':
        'Rebuild the frontend container now? Use this after changing build-time frontend flags.',
      'rebuild-stack':
        'Rebuild the full local stack now? This is the most disruptive option and will recreate multiple services.',
    };
    if (!window.confirm(confirmationText[action])) return;
    try {
      setStackActionLoading(action);
      setStackActionMessage(null);
      const response = await adminApi.runLocalStackAction(action);
      setStackActionMessage({
        tone: 'success',
        text: response?.message || `Local stack action '${action}' completed.`,
      });
    } catch (error) {
      setStackActionMessage({
        tone: 'error',
        text: `Failed to run '${action}': ${(error as Error).message}`,
      });
    } finally {
      setStackActionLoading(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10">
      {/* ── Top row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminCard
          icon={ToggleIcon}
          title="Configuration Mutability"
          color="from-cyan-500 to-blue-600"
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700/50 bg-slate-950/40">
              <div className="border-b border-slate-800/80 px-4 py-3">
                <div className="text-sm font-semibold text-white">Runtime Toggles</div>
                <div className="mt-1 text-xs text-slate-400">
                  Database-backed flags apply live from the admin UI.
                </div>
              </div>
              <div className="space-y-3 p-3">
                {operationalFlags.map((item) => (
                  <FlagRow
                    key={item.label}
                    item={item}
                    isLoading={isLoading}
                    onToggle={updateFeatureFlag}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              Scoring controls and deploy-time flags have their own dedicated sections below.
            </div>
          </div>
        </AdminCard>

        <AdminCard icon={ServerIcon} title="Stack Actions" color="from-emerald-500 to-teal-600">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              Use these only when you intentionally want to apply deploy-time or build-time config
              changes to the local Docker stack.
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={stackActionLoading !== null}
                onClick={() => runLocalStackAction('recreate-api')}
                className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-600/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stackActionLoading === 'recreate-api' ? 'Recreating API...' : 'Recreate API'}
              </button>
              <button
                type="button"
                disabled={stackActionLoading !== null}
                onClick={() => runLocalStackAction('rebuild-frontend')}
                className="rounded-lg border border-fuchsia-600/40 bg-fuchsia-600/10 px-3 py-2 text-sm text-fuchsia-100 transition hover:bg-fuchsia-600/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stackActionLoading === 'rebuild-frontend'
                  ? 'Rebuilding frontend...'
                  : 'Rebuild Frontend'}
              </button>
              <button
                type="button"
                disabled={stackActionLoading !== null}
                onClick={() => runLocalStackAction('rebuild-stack')}
                className="rounded-lg border border-blue-600/40 bg-blue-600/10 px-3 py-2 text-sm text-blue-100 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stackActionLoading === 'rebuild-stack'
                  ? 'Rebuilding full stack...'
                  : 'Rebuild Full Stack'}
              </button>
            </div>
            {stackActionMessage ? (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  stackActionMessage.tone === 'success'
                    ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-200'
                    : 'border-red-700/50 bg-red-900/20 text-red-200'
                }`}
              >
                {stackActionMessage.text}
              </div>
            ) : null}
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
              Read-only items shown here still come from frontend build-time config or API
              environment variables.
            </div>
          </div>
        </AdminCard>
      </div>

      {/* ── Scoring Controls ── */}
      <div>
        <SectionHeader
          title="Scoring Controls"
          description="Disable ML Training + ML Scoring and enable Simple Rule Scoring for pure rule mode."
        />
        <AdminCard icon={BrainIcon} title="Scoring Controls" color="from-indigo-500 to-violet-600">
          <div className="space-y-4">
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${scoringMode.className}`}
            >
              {scoringMode.label}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scoringFlags.map((item) => (
                <FlagRow
                  key={item.label}
                  item={item}
                  isLoading={isLoading}
                  onToggle={updateFeatureFlag}
                />
              ))}
            </div>
          </div>
        </AdminCard>
      </div>

      {/* ── Location & Mapping ── */}
      <div>
        <SectionHeader title="Location & Mapping" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>
      </div>

      {/* ── API Credentials ── */}
      <div>
        <SectionHeader title="API Credentials" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <GoogleMapsConfig
            googleMapsApiKey={googleMapsApiKey}
            setGoogleMapsApiKey={setGoogleMapsApiKey}
            savedGoogleMapsApiKey={savedValues.googleMapsApiKey}
            isSaving={isLoading}
            onSave={saveGoogleMapsApiKey}
            hasChanges={googleMapsApiKey !== savedValues.googleMapsApiKey}
            isConfigured={googleMapsConfigured}
          />
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

      {/* ── Deploy & Build Flags (collapsible) ── */}
      <div>
        <button
          type="button"
          onClick={() => setDeployFlagsOpen((o) => !o)}
          className="group mb-4 flex w-full items-center justify-between"
        >
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-300">
              Deploy &amp; Build Flags
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Environment and build-time flags — require container recreate or frontend rebuild.
            </p>
          </div>
          <ChevronIcon open={deployFlagsOpen} />
        </button>

        {deployFlagsOpen && (
          <AdminCard
            icon={ToggleIcon}
            title="Deploy & Build Flags"
            color="from-slate-500 to-slate-600"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-700/50 bg-slate-950/40">
                <div className="border-b border-slate-800/80 px-4 py-3">
                  <div className="text-sm font-semibold text-white">Deploy-Time Settings</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Environment-backed values require container recreate or restart to change.
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  {deployFlags.map((item) => (
                    <FlagRow
                      key={item.label}
                      item={item}
                      isLoading={isLoading}
                      onToggle={updateFeatureFlag}
                    />
                  ))}
                </div>
              </div>
            </div>
          </AdminCard>
        )}
      </div>
    </div>
  );
};

export default ConfigurationTab;
