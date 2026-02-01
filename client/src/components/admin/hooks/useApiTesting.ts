import { useState, useEffect } from 'react';
import { ApiHealth } from '../types/admin.types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiInput {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
}

export interface ApiPreset {
  label: string;
  path: string;
  method: HttpMethod;
  inputs?: ApiInput[];
  defaultBody?: string;
}

const API_PRESETS: ApiPreset[] = [
  // --- Geospatial ---
  { label: 'Mapbox Token', path: '/api/mapbox-token', method: 'GET' },
  { label: 'Google Maps Token', path: '/api/google-maps-token', method: 'GET' },
  { label: 'Home Location', path: '/api/home-location', method: 'GET' },

  // --- Networks & Filtered (v2) ---
  {
    label: 'Networks List (v2)',
    path: '/api/v2/networks',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'offset', label: 'Offset', defaultValue: '0', type: 'number' },
      { name: 'search', label: 'Search', placeholder: 'SSID/BSSID' },
      {
        name: 'sort',
        label: 'Sort',
        defaultValue: 'observed_at',
        type: 'select',
        options: ['observed_at', 'signal', 'threat_score', 'observations'],
      },
    ],
  },
  {
    label: 'Network Details (v2)',
    path: '/api/v2/networks/:bssid',
    method: 'GET',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22:33:44:55' }],
  },
  {
    label: 'Universal Filter: List',
    path: '/api/v2/networks/filtered',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{"ssid":""}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{"ssid":false}' },
    ],
  },
  {
    label: 'Universal Filter: Geo',
    path: '/api/v2/networks/filtered/geospatial',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },

  // --- Threat Analysis ---
  {
    label: 'Threat Map (v2)',
    path: '/api/v2/threats/map',
    method: 'GET',
    inputs: [
      { name: 'days', label: 'Days', defaultValue: '30', type: 'number' },
      {
        name: 'severity',
        label: 'Severity',
        defaultValue: 'all',
        type: 'select',
        options: ['all', 'critical', 'high', 'med', 'low'],
      },
    ],
  },
  { label: 'Threat Severity Counts', path: '/api/v2/threats/severity-counts', method: 'GET' },
  {
    label: 'Set Network Tag',
    path: '/api/network-tags/:bssid/threat',
    method: 'POST',
    inputs: [
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
      {
        name: 'threat_tag',
        label: 'Tag',
        defaultValue: 'SUSPECT',
        type: 'select',
        options: ['THREAT', 'SUSPECT', 'FALSE_POSITIVE', 'INVESTIGATE'],
      },
    ],
    defaultBody: '{\n  "threat_tag": "SUSPECT",\n  "threat_confidence": 0.7\n}',
  },

  // --- Analytics (v2) ---
  {
    label: 'Analytics: Filtered',
    path: '/api/v2/networks/filtered/analytics',
    method: 'GET',
    inputs: [
      { name: 'filters', label: 'Filters (JSON)', defaultValue: '{}' },
      { name: 'enabled', label: 'Enabled (JSON)', defaultValue: '{}' },
    ],
  },
  { label: 'Analytics: Legacy Dashboard', path: '/api/analytics/dashboard', method: 'GET' },

  // --- WiGLE ---
  { label: 'WiGLE Status', path: '/api/wigle/api-status', method: 'GET' },
  {
    label: 'WiGLE Search',
    path: '/api/wigle/search',
    method: 'GET',
    inputs: [
      { name: 'ssid', label: 'SSID', placeholder: 'Network Name' },
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
    ],
  },
  {
    label: 'WiGLE Detail & Import',
    path: '/api/wigle/detail/:netid',
    method: 'POST',
    inputs: [
      { name: 'netid', label: 'Network ID', placeholder: '00:11:22:33:44:55' },
      {
        name: 'import',
        label: 'Import?',
        defaultValue: 'false',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "import": false\n}',
  },
  {
    label: 'WiGLE BT Detail & Import',
    path: '/api/wigle/detail/bt/:netid',
    method: 'POST',
    inputs: [
      { name: 'netid', label: 'BT Network ID', placeholder: 'EC:81:93:76:BD:CE' },
      {
        name: 'import',
        label: 'Import?',
        defaultValue: 'false',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "import": false\n}',
  },

  // --- Machine Learning ---
  { label: 'ML Status', path: '/api/ml/status', method: 'GET' },
  {
    label: 'ML Score All',
    path: '/api/ml/score-all',
    method: 'POST',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '100', type: 'number' },
      {
        name: 'overwrite_final',
        label: 'Overwrite?',
        defaultValue: 'true',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
    defaultBody: '{\n  "limit": 100,\n  "overwrite_final": true\n}',
  },

  // --- System ---
  { label: 'App Settings', path: '/api/settings', method: 'GET' },
  {
    label: 'Export CSV',
    path: '/api/csv',
    method: 'GET',
    inputs: [{ name: 'limit', label: 'Limit', defaultValue: '100' }],
  },
];

export const useApiTesting = () => {
  const [endpoint, setEndpoint] = useState('/api/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState('');
  const [activePreset, setActivePreset] = useState<ApiPreset | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);

  const loadApiHealth = async () => {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setApiHealth({ status: 'Online', version: data.version || '1.0.0' });
    } catch {
      setApiHealth({ status: 'Offline', version: 'N/A' });
    }
  };

  const selectPreset = (preset: ApiPreset) => {
    setActivePreset(preset);
    setMethod(preset.method);
    setEndpoint(preset.path); // Use raw path template initially

    // Initialize default values
    const newParams: Record<string, string> = {};
    preset.inputs?.forEach((input) => {
      newParams[input.name] = input.defaultValue || '';
    });
    setParamValues(newParams);

    if (preset.defaultBody) {
      setBody(preset.defaultBody);
    } else {
      setBody('');
    }
  };

  const updateParam = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  // Construct final URL dynamically
  const constructUrl = () => {
    if (!activePreset) return endpoint;

    let finalPath = activePreset.path;
    const queryParams = new URLSearchParams();

    // Iterate over defined inputs to either replace path params or add to query string
    activePreset.inputs?.forEach((input) => {
      const val = paramValues[input.name];
      if (val) {
        // If the path contains the param (e.g. :bssid), replace it
        if (finalPath.includes(`:${input.name}`)) {
          finalPath = finalPath.replace(`:${input.name}`, encodeURIComponent(val));
        } else {
          // Otherwise treat as query param
          queryParams.append(input.name, val);
        }
      }
    });

    // Validation: Check if any path parameters (starting with :) are left unresolved
    if (finalPath.includes('/:')) {
      // Find the missing param name for a better error message (simple check)
      const missingParam = finalPath.split('/:').pop()?.split('/')[0];
      throw new Error(`Missing required path parameter: ${missingParam}`);
    }

    const queryString = queryParams.toString();
    return queryString ? `${finalPath}?${queryString}` : finalPath;
  };

  const runApiRequest = async () => {
    setApiError('');
    setApiResult(null);
    setApiLoading(true);
    const start = performance.now();

    try {
      // Use manual endpoint if no preset, or constructed URL if preset active
      const finalUrl = activePreset ? constructUrl() : endpoint;
      // Update displayed endpoint to match what we sent
      setEndpoint(finalUrl);

      const opts: RequestInit = { method };

      // Handle body adjustments for inputs (like 'import' flag)
      let finalBody = body;
      if (activePreset?.defaultBody && paramValues) {
        // Simple template replacement for body params if needed (advanced)
        // For now, we rely on user editing the JSON or basic defaults
        try {
          const bodyObj = JSON.parse(body);
          // If we have an input that matches a body key, update it
          activePreset.inputs?.forEach((input) => {
            if (Object.prototype.hasOwnProperty.call(bodyObj, input.name)) {
              // Convert "true"/"false" strings to booleans if needed
              if (input.name === 'import' || input.name === 'overwrite_final') {
                bodyObj[input.name] = paramValues[input.name] === 'true';
              } else {
                bodyObj[input.name] = paramValues[input.name];
              }
            }
          });
          finalBody = JSON.stringify(bodyObj, null, 2);
          setBody(finalBody); // Update UI
        } catch (e) {
          // ignore invalid JSON
        }
      }

      if (method !== 'GET' && method !== 'DELETE' && finalBody.trim()) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = finalBody;
      }

      const res = await fetch(finalUrl, opts);
      const text = await res.text();
      setApiResult({
        ok: res.ok,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        body: text,
      });
    } catch (err: any) {
      setApiError(err?.message || 'Request failed');
    } finally {
      setApiLoading(false);
    }
  };

  return {
    endpoint,
    setEndpoint,
    method,
    setMethod,
    body,
    setBody,
    activePreset,
    paramValues,
    selectPreset,
    updateParam,
    apiLoading,
    apiResult,
    apiError,
    apiHealth,
    loadApiHealth,
    runApiRequest,
    API_PRESETS,
  };
};
