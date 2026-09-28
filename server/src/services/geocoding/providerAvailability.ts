import type { GeocodeProvider } from './types';

const isProviderRuntimeEligible = (provider: GeocodeProvider): boolean =>
  provider !== 'overpass' || process.env.GEOCODING_OVERPASS_ENABLED === 'true';

export { isProviderRuntimeEligible };
