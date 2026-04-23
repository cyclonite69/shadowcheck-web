import { useMemo } from 'react';
import type { FlagItem } from '../tabs/config/ConfigFlagRow';

interface UseConfigurationFlagsProps {
  featureFlags: any;
  demoMode: boolean;
}

export const useConfigurationFlags = ({ featureFlags, demoMode }: UseConfigurationFlagsProps) => {
  const operationalFlags = useMemo<FlagItem[]>(
    () => [
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
    ],
    [featureFlags]
  );

  const deployFlags = useMemo<FlagItem[]>(
    () => [
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
    ],
    [featureFlags, demoMode]
  );

  return {
    operationalFlags,
    deployFlags,
  };
};
