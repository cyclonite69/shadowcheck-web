import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useApiTesting } from '../hooks/useApiTesting';

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

const LockIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
    apiHealth,
    loadApiHealth,
  } = useApiTesting();

  React.useEffect(() => {
    loadApiHealth();
  }, []);

  const [usernameInput, setUsernameInput] = React.useState('admin');
  const [passwordInput, setPasswordInput] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(usernameInput, passwordInput);
    if (success) {
      setPasswordInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Authentication Manager */}
      <AdminCard icon={LockIcon} title="Authentication Manager" color="from-amber-500 to-amber-600">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Test Session Authentication
            </div>

            {isAuthenticated ? (
              <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/50 flex flex-col justify-between h-[130px]">
                <div>
                  <div className="text-xs text-slate-400">Authenticated Session User</div>
                  <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1.5 font-mono">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    {authenticatedUser}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full px-3 py-2 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 hover:text-rose-200 rounded-lg font-medium text-xs transition-all shadow-sm"
                >
                  Logout Test Session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="admin"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full px-3 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-semibold hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 text-xs shadow-md"
                >
                  {loginLoading ? 'Authenticating...' : 'Login & Establish Session'}
                </button>

                {loginError && (
                  <div className="text-red-400 text-[11px] p-2 bg-red-950/20 rounded border border-red-800/40">
                    ⚠️ {loginError}
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Right: Auth Controls / Toggles */}
          <div className="flex flex-col justify-between space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Authentication Mode
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Toggle whether test requests carry your authenticated session cookie.
                Unauthenticated mode helps verify that access control gates deny requests correctly.
              </p>

              <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setUseAuthentication(false)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                    !useAuthentication
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🔒 Unauthenticated
                </button>
                <button
                  type="button"
                  disabled={!isAuthenticated}
                  onClick={() => setUseAuthentication(true)}
                  className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    useAuthentication
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-500 cursor-not-allowed'
                  }`}
                  title={
                    !isAuthenticated ? 'Establish a session first to run authenticated tests' : ''
                  }
                >
                  🔑 Authenticated
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/30 text-slate-400">
              <span className="font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-mono">
                Status
              </span>
              <span>
                {useAuthentication && isAuthenticated ? (
                  <span className="text-amber-400 font-medium">
                    Requests will be sent with session token cookie.
                  </span>
                ) : (
                  <span>Requests will be sent with cookies omitted.</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Bulk Endpoint Verification */}
      <AdminCard
        icon={ApiIcon}
        title="Bulk Endpoint Verification"
        color="from-emerald-500 to-emerald-600"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-400 pb-2 border-b border-slate-800/60">
            <div className="flex flex-col gap-1">
              <span>
                Target Database:{' '}
                <span className="font-mono font-bold text-blue-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50">
                  {apiHealth?.database || 'Loading...'}
                </span>
              </span>
              <span>
                API Health:{' '}
                <span
                  className={`font-semibold ${apiHealth?.status === 'HEALTHY' || apiHealth?.status === 'ONLINE' ? 'text-green-400' : 'text-amber-400'}`}
                >
                  {apiHealth?.status || 'Loading...'}
                </span>
              </span>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              App Version: <span className="font-mono">{apiHealth?.version || 'N/A'}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <span className="text-xs text-slate-400">
              Run automated checks against safe registered endpoints. Manual, destructive, and
              external-effect presets are never included.
            </span>
            <button
              onClick={runAllTests}
              disabled={testingAll || apiLoading}
              className={
                'px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-medium hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 text-xs shadow-md shrink-0'
              }
            >
              {testingAll ? 'Running Checks...' : 'Run Automated Presets'}
            </button>
          </div>

          {testAllResults.length > 0 && (
            <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/50">
              <div className="max-h-[250px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                      <th className="p-2">Method</th>
                      <th className="p-2">Endpoint</th>
                      <th className="p-2">Label</th>
                      <th className="p-2 text-center">Mode</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {testAllResults.map((res, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-2 font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] ${
                              res.method === 'GET'
                                ? 'bg-blue-900/40 text-blue-300'
                                : res.method === 'POST'
                                  ? 'bg-emerald-900/40 text-emerald-300'
                                  : res.method === 'DELETE'
                                    ? 'bg-red-900/40 text-red-300'
                                    : 'bg-amber-900/40 text-amber-300'
                            }`}
                          >
                            {res.method}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-slate-300 break-all">{res.path}</td>
                        <td className="p-2 text-slate-400">{res.label}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              res.usedAuth
                                ? 'bg-amber-950/40 text-amber-300 border border-amber-800/30'
                                : 'bg-slate-800/40 text-slate-400'
                            }`}
                          >
                            {res.usedAuth ? '🔑 Auth' : '🔒 Public'}
                          </span>
                        </td>
                        <td className="p-2 text-center font-bold">
                          <span
                            className={
                              res.resultStatus === 'pass'
                                ? 'text-green-400'
                                : res.resultStatus === 'auth'
                                  ? 'text-slate-400'
                                  : res.resultStatus === 'validation'
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                            }
                          >
                            {res.resultStatus === 'pass' && '✅ '}
                            {res.resultStatus === 'auth' && '🔒 '}
                            {res.resultStatus === 'validation' && '⚠️ '}
                            {res.resultStatus === 'fail' && '❌ '}
                            {res.status}
                          </span>
                        </td>
                        <td className="p-2 text-right text-slate-500 font-mono">
                          {res.durationMs !== undefined ? `${res.durationMs}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-800/80 p-2 text-right border-t border-slate-700 text-[10px] text-slate-400">
                Tested: <strong className="text-slate-200">{testAllResults.length}</strong> /{' '}
                {AUTOMATED_API_PRESETS.length} | ✅ Pass:{' '}
                <strong className="text-green-400">
                  {testAllResults.filter((r) => r.resultStatus === 'pass').length}
                </strong>{' '}
                | 🔒 Auth:{' '}
                <strong className="text-slate-400">
                  {testAllResults.filter((r) => r.resultStatus === 'auth').length}
                </strong>{' '}
                | ⚠️ Validation:{' '}
                <strong className="text-amber-400">
                  {testAllResults.filter((r) => r.resultStatus === 'validation').length}
                </strong>{' '}
                | ❌ Errors:{' '}
                <strong className="text-red-400">
                  {testAllResults.filter((r) => r.resultStatus === 'fail').length}
                </strong>
              </div>
            </div>
          )}
          <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800/50 mt-4">
            <span className="text-[10px] text-slate-400 leading-normal">
              Bulk verification contains {AUTOMATED_API_PRESETS.length} safe presets. The{' '}
              {MANUAL_API_PRESETS.length} operator-effect presets remain available below for
              deliberate individual testing.
            </span>
          </div>
        </div>
      </AdminCard>

      <AdminCard icon={ApiIcon} title="Automated Presets" color="from-blue-500 to-blue-600" compact>
        <div className="flex flex-wrap gap-2">
          {AUTOMATED_API_PRESETS.map((preset) => (
            <button
              key={`${preset.method}-${preset.path}`}
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

      <AdminCard
        icon={LockIcon}
        title="Manual / Destructive / External-Effect Endpoints"
        color="from-amber-500 to-red-600"
        compact
      >
        <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
          Operator-selected testing only. Confirm the target shown above is an isolated test
          database before sending a request. These presets are never included in bulk verification.
        </div>
        <div className="flex flex-wrap gap-2">
          {MANUAL_API_PRESETS.map((preset) => (
            <button
              key={`${preset.method}-${preset.path}`}
              onClick={() => selectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg border text-xs text-white transition-colors font-medium ${
                activePreset?.method === preset.method && activePreset?.path === preset.path
                  ? 'bg-amber-700 border-amber-400 shadow-md'
                  : 'border-amber-800/60 bg-amber-950/30 hover:border-amber-500/70'
              }`}
            >
              <span className="mr-1 text-[9px] font-mono text-amber-300">{preset.method}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </AdminCard>

      {/* Request/Response — equal split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Request Panel */}
        <AdminCard icon={UploadIcon} title="Request" color="from-purple-500 to-purple-600">
          <div className="space-y-4">
            {(activePreset?.manualOnly || activePreset?.isDestructive) && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
                Manual operator-effect preset selected. Verify this request targets the isolated
                test database before sending it.
              </div>
            )}
            {/* Dynamic Inputs for Preset */}
            {activePreset && activePreset.params && activePreset.params.length > 0 && (
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 space-y-3">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Parameters
                </div>
                {activePreset.params.map((input) => (
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
            <div className="flex flex-wrap gap-4 text-sm pb-3 border-b border-slate-700/50">
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
              {apiResult && (
                <div>
                  <span className="text-slate-400">Mode: </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      apiResult.usedAuth
                        ? 'bg-amber-950/40 text-amber-300 border border-amber-800/30'
                        : 'bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    {apiResult.usedAuth ? '🔑 Authenticated' : '🔒 Unauthenticated'}
                  </span>
                </div>
              )}
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
