import { useState } from 'react';
import { ApiHealth } from '../types/admin.types';
import { API_PRESETS, ApiPreset, HttpMethod } from './apiTestingPresets';

export type { ApiInput, ApiPreset } from './apiTestingPresets';

export const useApiTesting = () => {
  const [endpoint, setEndpoint] = useState('/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState('');
  const [activePreset, setActivePreset] = useState<ApiPreset | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);

  const loadApiHealth = async () => {
    const candidates = ['/health', '/api/health'];

    for (const path of candidates) {
      try {
        const res = await fetch(path);
        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = null;
        }

        const reportedStatus =
          typeof parsed?.status === 'string' ? String(parsed.status).toUpperCase() : 'ONLINE';
        const version = parsed?.version || 'N/A';
        setApiHealth({ status: reportedStatus, version });
        return;
      } catch {
        // Try next candidate.
      }
    }

    setApiHealth({ status: 'OFFLINE', version: 'N/A' });
  };

  const selectPreset = (preset: ApiPreset) => {
    setActivePreset(preset);
    setMethod(preset.method);
    setEndpoint(preset.path);

    const newParams: Record<string, string> = {};
    preset.inputs?.forEach((input) => {
      newParams[input.name] = input.defaultValue || '';
    });
    setParamValues(newParams);
    setBody(preset.defaultBody || '');
  };

  const updateParam = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const constructUrl = () => {
    if (!activePreset) return endpoint;

    let finalPath = activePreset.path;
    const queryParams = new URLSearchParams();

    activePreset.inputs?.forEach((input) => {
      const val = paramValues[input.name];
      if (!val) return;

      if (finalPath.includes(`:${input.name}`)) {
        finalPath = finalPath.replace(`:${input.name}`, encodeURIComponent(val));
      } else {
        queryParams.append(input.name, val);
      }
    });

    if (finalPath.includes('/:')) {
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
      const finalUrl = activePreset ? constructUrl() : endpoint;
      setEndpoint(finalUrl);

      const opts: RequestInit = { method };
      let finalBody = body;

      if (activePreset?.defaultBody && paramValues) {
        try {
          const bodyObj = JSON.parse(body);
          activePreset.inputs?.forEach((input) => {
            if (!Object.prototype.hasOwnProperty.call(bodyObj, input.name)) return;

            if (input.name === 'import' || input.name === 'overwrite_final') {
              bodyObj[input.name] = paramValues[input.name] === 'true';
            } else {
              bodyObj[input.name] = paramValues[input.name];
            }
          });
          finalBody = JSON.stringify(bodyObj, null, 2);
          setBody(finalBody);
        } catch {
          // Ignore invalid JSON body editing.
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
