import { useState } from 'react';
import { ApiHealth } from '../../../types/admin';
import {
  AUTOMATED_API_PRESETS,
  MANUAL_API_PRESETS,
  ApiPreset,
  HttpMethod,
} from './apiTestingPresets';

export type { ApiInput, ApiPreset } from './apiTestingPresets';

export type EndpointResultStatus = 'pass' | 'auth' | 'validation' | 'fail';

export function categorizeStatus(
  httpStatus: number | null,
  isNetworkError: boolean
): EndpointResultStatus {
  if (isNetworkError || httpStatus === null) {
    return 'fail';
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return 'pass';
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return 'auth';
  }
  if (httpStatus === 400 || httpStatus === 422) {
    return 'validation';
  }
  if (httpStatus >= 500) {
    return 'fail';
  }
  return 'validation';
}

export const useApiTesting = () => {
  const [endpoint, setEndpoint] = useState('/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState('');
  const [activePreset, setActivePreset] = useState<ApiPreset | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const [apiLoading, setApiLoading] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [useAuthentication, setUseAuthentication] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const login = async (username: string, password: string) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setAuthenticatedUser(data.user?.username || username);
        setUseAuthentication(true);
        return true;
      } else {
        setLoginError(data.error || 'Authentication failed');
        return false;
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login request failed');
      return false;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore logout request errors
    } finally {
      setIsAuthenticated(false);
      setAuthenticatedUser(null);
      setUseAuthentication(false);
    }
  };
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
        const database = parsed?.database || 'N/A';
        setApiHealth({ status: reportedStatus, version, database });
        return;
      } catch {
        // Try next candidate.
      }
    }

    setApiHealth({ status: 'OFFLINE', version: 'N/A', database: 'N/A' });
  };

  const selectPreset = (preset: ApiPreset) => {
    setActivePreset(preset);
    setMethod(preset.method);
    setEndpoint(preset.path);

    const newParams: Record<string, string> = {};
    preset.params?.forEach((input) => {
      newParams[input.name] = input.defaultValue || '';
    });
    setParamValues(newParams);
    setBody(preset.defaultBody || '');
  };

  const updateParam = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const constructUrl = () => {
    if (!activePreset) {
      return endpoint;
    }

    let finalPath = activePreset.path;
    const queryParams = new URLSearchParams();

    activePreset.params?.forEach((input) => {
      const val = paramValues[input.name];
      if (!val) {
        return;
      }

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

      const opts: RequestInit = {
        method,
        credentials: useAuthentication && isAuthenticated ? 'include' : 'omit',
      };
      let finalBody = body;

      if (activePreset?.defaultBody && paramValues) {
        try {
          const bodyObj = JSON.parse(body);
          activePreset.params?.forEach((input) => {
            if (!Object.prototype.hasOwnProperty.call(bodyObj, input.name)) {
              return;
            }

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
        usedAuth: useAuthentication && isAuthenticated,
      });
    } catch (err: any) {
      setApiError(err?.message || 'Request failed');
    } finally {
      setApiLoading(false);
    }
  };

  const [testingAll, setTestingAll] = useState(false);
  const [testAllResults, setTestAllResults] = useState<any[]>([]);

  const runAllTests = async () => {
    setTestingAll(true);
    setTestAllResults([]);
    const results: any[] = [];

    // Fallback values for common path parameters
    const FALLBACK_PARAMS: Record<string, string> = {
      bssid: '9A:9D:5D:81:16:1E',
      oui: '9A9D5D',
      runId: '18',
      uploadId: '1',
      noteId: '1',
      mediaId: '6',
      userId: '3',
      termId: '1',
      key: 'enable_background_jobs',
      instanceId: 'i-06380d0c9c99f6124',
      filename: 'Screenshot_20260421_032056.png',
      action: 'recreate-api',
      id: '1',
      label: 'default',
      z: '14',
      x: '4680',
      y: '6340',
      type: 'satellite',
    };

    for (const preset of AUTOMATED_API_PRESETS) {
      let finalUrl = preset.path;
      const queryParams = new URLSearchParams();
      const replacedParams = new Set<string>();

      preset.params?.forEach((input) => {
        const val =
          paramValues[input.name] || input.defaultValue || FALLBACK_PARAMS[input.name] || '1';
        if (finalUrl.includes(`:${input.name}`)) {
          finalUrl = finalUrl.replace(`:${input.name}`, encodeURIComponent(val));
          replacedParams.add(input.name);
        } else {
          queryParams.append(input.name, val);
        }
      });

      const paramRegex = /:([a-zA-Z0-9_]+)/g;
      let match;
      while ((match = paramRegex.exec(finalUrl)) !== null) {
        const paramName = match[1];
        if (!replacedParams.has(paramName)) {
          const fallback = FALLBACK_PARAMS[paramName] || '1';
          finalUrl = finalUrl.replace(`:${paramName}`, encodeURIComponent(fallback));
          replacedParams.add(paramName);
        }
      }

      finalUrl = finalUrl.replace(/\(\*\)/g, '');

      const queryString = queryParams.toString();
      const resolvedUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

      const start = performance.now();
      try {
        const opts: RequestInit = {
          method: preset.method,
          credentials: useAuthentication && isAuthenticated ? 'include' : 'omit',
        };
        if (preset.method !== 'GET' && preset.method !== 'DELETE' && preset.defaultBody) {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = preset.defaultBody;
        }

        const res = await fetch(resolvedUrl, opts);
        const text = await res.text();
        const outcome = {
          label: preset.label,
          category: preset.category,
          method: preset.method,
          path: resolvedUrl,
          ok: res.ok,
          status: res.status,
          resultStatus: categorizeStatus(res.status, false),
          durationMs: Math.round(performance.now() - start),
          body: text,
          usedAuth: useAuthentication && isAuthenticated,
        };

        results.push(outcome);
        setTestAllResults([...results]);
      } catch (err: any) {
        const outcome = {
          label: preset.label,
          category: preset.category,
          method: preset.method,
          path: resolvedUrl,
          ok: false,
          status: 'ERR',
          resultStatus: 'fail' as const,
          durationMs: Math.round(performance.now() - start),
          error: err?.message || 'Request failed',
          usedAuth: useAuthentication && isAuthenticated,
        };
        results.push(outcome);
        setTestAllResults([...results]);
      }
    }

    setTestingAll(false);
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
    AUTOMATED_API_PRESETS,
    MANUAL_API_PRESETS,
    testingAll,
    testAllResults,
    runAllTests,
    isAuthenticated,
    authenticatedUser,
    useAuthentication,
    setUseAuthentication,
    loginLoading,
    loginError,
    login,
    logout,
  };
};
