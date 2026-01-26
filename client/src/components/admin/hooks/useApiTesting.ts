import { useState, useEffect } from 'react';
import { ApiHealth } from '../types/admin.types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const API_PRESETS: { label: string; path: string; method: HttpMethod }[] = [
  { label: 'Health', path: '/api/health', method: 'GET' },
  { label: 'Dashboard', path: '/api/dashboard-metrics', method: 'GET' },
  { label: 'Networks', path: '/api/explorer/networks?limit=10', method: 'GET' },
  { label: 'ML Train', path: '/api/ml/train', method: 'POST' },
  { label: 'Kepler', path: '/api/kepler/data?limit=50', method: 'GET' },
];

export const useApiTesting = () => {
  const [endpoint, setEndpoint] = useState('/api/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);

  const loadApiHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setApiHealth({ status: 'Online', version: data.version || '1.0.0' });
    } catch {
      setApiHealth({ status: 'Offline', version: 'N/A' });
    }
  };

  const runApiRequest = async () => {
    setApiError('');
    setApiResult(null);
    setApiLoading(true);
    const start = performance.now();
    try {
      const opts: RequestInit = { method };
      if (method !== 'GET' && method !== 'DELETE' && body.trim()) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = body;
      }
      const res = await fetch(endpoint, opts);
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
    apiLoading,
    apiResult,
    apiError,
    apiHealth,
    loadApiHealth,
    runApiRequest,
    API_PRESETS,
  };
};
