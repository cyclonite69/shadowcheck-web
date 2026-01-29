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
  // --- Core & Dashboard ---
  { label: 'Health', path: '/health', method: 'GET' },
  { label: 'Dashboard Metrics (v2)', path: '/api/v2/dashboard/metrics', method: 'GET' },

  // --- Networks V2 ---
  {
    label: 'Networks List (v2)',
    path: '/api/v2/networks',
    method: 'GET',
    inputs: [
      { name: 'limit', label: 'Limit', defaultValue: '10', type: 'number' },
      { name: 'offset', label: 'Offset', defaultValue: '0', type: 'number' },
      { name: 'search', label: 'Search', placeholder: 'SSID' },
      {
        name: 'sort',
        label: 'Sort',
        defaultValue: 'observed_at',
        type: 'select',
        options: ['observed_at', 'signal', 'threat_score'],
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

  // --- WiGLE ---
  { label: 'WiGLE Status', path: '/api/wigle/api-status', method: 'GET' },
  {
    label: 'WiGLE Search (v2)',
    path: '/api/wigle/search',
    method: 'GET',
    inputs: [
      { name: 'ssid', label: 'SSID', placeholder: 'Network Name' },
      { name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' },
    ],
  },
  {
    label: 'WiGLE Detail (v3)',
    path: '/api/wigle/detail/:netid',
    method: 'POST',
    inputs: [
      { name: 'netid', label: 'Network ID (BSSID)', placeholder: '00:11:22:33:44:55' },
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
    label: 'WiGLE Map Data (v3)',
    path: '/api/wigle/networks-v3',
    method: 'GET',
    inputs: [{ name: 'limit', label: 'Limit', defaultValue: '1000', type: 'number' }],
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
  {
    label: 'ML Score (Single)',
    path: '/api/ml/scores/:bssid',
    method: 'GET',
    inputs: [{ name: 'bssid', label: 'BSSID', placeholder: '00:11:22...' }],
  },

  // --- Analytics ---
  { label: 'Analytics: Dashboard', path: '/api/analytics/dashboard', method: 'GET' },
  { label: 'Analytics: Network Types', path: '/api/analytics/network-types', method: 'GET' },
  { label: 'Analytics: Signal Dist', path: '/api/analytics/signal-strength', method: 'GET' },
  {
    label: 'Analytics: Top Networks',
    path: '/api/analytics/top-networks',
    method: 'GET',
    inputs: [{ name: 'limit', label: 'Limit', defaultValue: '10' }],
  },
  {
    label: 'Analytics: Threat Trends',
    path: '/api/analytics/threat-trends',
    method: 'GET',
    inputs: [
      {
        name: 'range',
        label: 'Range',
        defaultValue: '30d',
        type: 'select',
        options: ['24h', '7d', '30d', '90d'],
      },
    ],
  },

  // --- Geospatial ---
  { label: 'Mapbox Token', path: '/api/mapbox-token', method: 'GET' },

  // --- Export ---
  {
    label: 'Export CSV',
    path: '/api/export/csv',
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
