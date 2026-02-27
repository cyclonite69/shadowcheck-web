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
  } = useApiTesting();

  const healthStatus = apiHealth?.status || 'Checking...';
  const healthColorClass =
    healthStatus === 'OFFLINE'
      ? 'text-red-400'
      : healthStatus === 'DEGRADED' || healthStatus === 'UNHEALTHY'
        ? 'text-amber-400'
        : 'text-green-400';

  useEffect(() => {
    loadApiHealth();
  }, []);

  return (
    <div className="space-y-4">
      {/* Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard icon={DatabaseIcon} title="API Status" color="from-cyan-500 to-cyan-600" compact>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Status:</span>
              <span className={`font-semibold ${healthColorClass}`}>{healthStatus}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Version:</span>
              <span className="text-blue-400 font-semibold">{apiHealth?.version || 'N/A'}</span>
            </div>
          </div>
        </AdminCard>

        <div className="md:col-span-2">
          <AdminCard icon={ApiIcon} title="Quick Presets" color="from-blue-500 to-blue-600" compact>
            <div className="flex flex-wrap gap-2">
              {API_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => selectPreset(preset)}
                  className={`px-3 py-1.5 rounded-lg border text-xs text-white transition-colors font-medium ${
                    activePreset?.label === preset.label
                      ? 'bg-blue-600 border-blue-400 shadow-md'
                      : 'border-slate-600/60 bg-slate-800/50 hover:border-blue-500/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </AdminCard>
        </div>
      </div>

      {/* Request/Response */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Request Panel */}
        <AdminCard icon={UploadIcon} title="Request" color="from-purple-500 to-purple-600">
          <div className="space-y-4">
            {/* Dynamic Inputs for Preset */}
            {activePreset && activePreset.inputs && activePreset.inputs.length > 0 && (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 space-y-3">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Parameters
                </div>
                {activePreset.inputs.map((input) => (
                  <div key={input.name}>
                    <label className="block text-xs text-slate-400 mb-1">
                      {input.label} <span className="text-slate-600 font-mono">({input.name})</span>
                    </label>
                    {input.type === 'select' ? (
                      <select
                        value={paramValues[input.name] || ''}
                        onChange={(e) => updateParam(input.name, e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        {input.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={input.type || 'text'}
                        value={paramValues[input.name] || ''}
                        onChange={(e) => updateParam(input.name, e.target.value)}
                        placeholder={input.placeholder || ''}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Endpoint
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Body (JSON)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder='{"key":"value"}'
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all font-mono text-xs"
              />
            </div>

            <button
              onClick={runApiRequest}
              disabled={apiLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 transition-all disabled:opacity-50 text-sm"
            >
              {apiLoading ? 'Sending...' : 'Send Request'}
            </button>

            {apiError && (
              <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-700/50">
                {apiError}
              </div>
            )}
          </div>
        </AdminCard>

        {/* Response Panel */}
        <AdminCard icon={DownloadIcon} title="Response" color="from-emerald-500 to-emerald-600">
          <div className="space-y-3">
            <div className="flex gap-4 text-sm pb-3 border-b border-slate-700/50">
              <div>
                <span className="text-slate-400">Status: </span>
                <strong className={apiResult?.ok ? 'text-green-400' : 'text-red-400'}>
                  {apiResult?.status || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Duration: </span>
                <strong className="text-blue-400">
                  {apiResult ? `${apiResult.durationMs} ms` : '—'}
                </strong>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all max-h-[220px] overflow-auto font-mono">
                {apiResult?.body || 'No response yet. Send a request to see results here.'}
              </pre>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
