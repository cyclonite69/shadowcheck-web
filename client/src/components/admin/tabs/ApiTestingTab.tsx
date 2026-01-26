import React, { useEffect } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useApiTesting } from '../hooks/useApiTesting';

const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const ApiIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22 6 12 13 2 6" />
  </svg>
);

const UploadIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DownloadIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const ApiTestingTab: React.FC = () => {
  const {
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
  } = useApiTesting();

  useEffect(() => {
    loadApiHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* API Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard icon={DatabaseIcon} title="API Status" color="from-cyan-500 to-cyan-600">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300 text-sm">Status:</span>
              <span
                className={`text-sm font-semibold ${
                  apiHealth?.status === 'Online' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {apiHealth?.status || 'Checking...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300 text-sm">Version:</span>
              <span className="text-sm font-semibold text-blue-400">
                {apiHealth?.version || 'N/A'}
              </span>
            </div>
          </div>
        </AdminCard>
        <div className="md:col-span-2">
          <AdminCard icon={ApiIcon} title="Quick Presets" color="from-blue-500 to-blue-600">
            <div className="flex flex-wrap gap-2">
              {API_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setEndpoint(preset.path);
                    setMethod(preset.method);
                    setBody('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:border-blue-500 text-xs text-white transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </AdminCard>
        </div>
      </div>

      {/* Request/Response */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminCard icon={UploadIcon} title="Request" color="from-purple-500 to-purple-600">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Endpoint</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Body (JSON)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder='{"key":"value"}'
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={runApiRequest}
              disabled={apiLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-blue-600 disabled:opacity-50"
            >
              {apiLoading ? 'Sending...' : 'Send Request'}
            </button>
            {apiError && <div className="text-red-400 text-sm">{apiError}</div>}
          </div>
        </AdminCard>

        <AdminCard icon={DownloadIcon} title="Response" color="from-emerald-500 to-emerald-600">
          <div className="space-y-3">
            <div className="flex gap-4 text-sm text-slate-300 pb-2 border-b border-slate-700">
              <span>
                Status:{' '}
                <strong className={apiResult?.ok ? 'text-green-400' : 'text-red-400'}>
                  {apiResult?.status || '—'}
                </strong>
              </span>
              <span>
                Duration:{' '}
                <strong className="text-blue-400">
                  {apiResult ? `${apiResult.durationMs} ms` : '—'}
                </strong>
              </span>
            </div>
            <pre className="text-xs text-slate-200 whitespace-pre-wrap break-all max-h-[200px] overflow-auto bg-slate-800/50 p-3 rounded-lg">
              {apiResult?.body || 'No response yet.'}
            </pre>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
