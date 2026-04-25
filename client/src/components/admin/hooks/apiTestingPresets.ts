/**
 * Backward-compat re-export shim.
 * All endpoint data now lives in `client/src/config/apiTestEndpoints.ts`.
 * Import from there for new code; existing hook imports from here still work.
 */
export type {
  ApiInput,
  ApiEndpointConfig as ApiPreset,
  HttpMethod,
} from '../../../config/apiTestEndpoints';
export { API_ENDPOINTS as API_PRESETS } from '../../../config/apiTestEndpoints';
