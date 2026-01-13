import React, { useState } from 'react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const PRESETS: { label: string; path: string; method: HttpMethod }[] = [
  { label: 'Health', path: '/api/health', method: 'GET' },
  { label: 'Dashboard metrics', path: '/api/dashboard-metrics', method: 'GET' },
  { label: 'Networks Explorer (latest)', path: '/api/explorer/networks?limit=10', method: 'GET' },
  { label: 'ML train', path: '/api/ml/train', method: 'POST' },
  { label: 'ML reassess', path: '/api/ml/reassess', method: 'POST' },
  { label: 'Kepler data', path: '/api/kepler/data?limit=50', method: 'GET' },
];

type ApiResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  body: string;
};

const ApiTestPage: React.FC = () => {
  const [endpoint, setEndpoint] = useState<string>('/api/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string>('');

  const runRequest = async () => {
    setError('');
    setResult(null);
    setLoading(true);
    const start = performance.now();
    try {
      const opts: RequestInit = { method };
      if (method !== 'GET' && method !== 'DELETE' && body.trim()) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = body;
      }
      const res = await fetch(endpoint, opts);
      const text = await res.text();
      setResult({
        ok: res.ok,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        body: text,
      });
    } catch (err: any) {
      setError(err?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 p-6 z-50 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/60 shadow-2xl">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
              filter:
                'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 30px rgba(100, 116, 139, 0.3))',
            }}
          >
            API Endpoint Tester
          </h1>
          <p
            className="text-lg font-bold tracking-tight"
            style={{
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
              filter:
                'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 30px rgba(100, 116, 139, 0.3))',
              marginTop: '4px',
            }}
          >
            Quickly exercise backend endpoints without leaving the app
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: '200px' }} className="p-6 space-y-4">
        {/* Presets Card */}
        <div className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />
          <div className="flex items-center gap-2 p-4 bg-[#132744]/95 border-b border-[#1c3050]">
            <h3 className="text-sm font-semibold text-white">Presets</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setEndpoint(preset.path);
                  setMethod(preset.method);
                  setBody('');
                }}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:border-blue-500 text-sm text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Request Card */}
          <div className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />
            <div className="flex items-center gap-2 p-4 bg-[#132744]/95 border-b border-[#1c3050]">
              <h3 className="text-sm font-semibold text-white">Request</h3>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                Endpoint
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-200">
                Body (JSON)
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder='{"key":"value"}'
                  className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </label>
              <button
                onClick={runRequest}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
              >
                {loading ? 'Sending…' : 'Send Request'}
              </button>
              {error && <div className="text-red-400 text-sm">{error}</div>}
            </div>
          </div>

          {/* Response Card */}
          <div className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />
            <div className="flex items-center justify-between p-4 bg-[#132744]/95 border-b border-[#1c3050]">
              <h3 className="text-sm font-semibold text-white">Response</h3>
              <div className="flex gap-4 text-sm text-slate-300">
                <span>Status: {result ? result.status : '—'}</span>
                <span>Duration: {result ? `${result.durationMs} ms` : '—'}</span>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-xs text-slate-200 whitespace-pre-wrap break-all max-h-[360px] overflow-auto">
                {result?.body || 'No response yet.'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTestPage;
