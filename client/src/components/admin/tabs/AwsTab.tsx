import React, { useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { SsmTerminal } from '../components/SsmTerminal';
import { useAwsOverview } from '../hooks/useAwsOverview';
import { useAwsInstanceAction } from '../../../hooks/useAwsInstanceAction';

const CloudIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 19h11.5z" />
  </svg>
);

export const AwsTab: React.FC = () => {
  const { overview, loading, error, refresh } = useAwsOverview();
  const { actionLoading, actionError, performAction } = useAwsInstanceAction();
  const [confirmTerminate, setConfirmTerminate] = useState<string | null>(null);
  const [ssmInstanceId, setSsmInstanceId] = useState<string | null>(null);

  const instances = overview?.instances || [];
  const counts = overview?.counts || { total: 0, states: {} };
  const stateBadges = Object.entries(counts.states || {});
  const displayError = error || overview?.error || actionError;

  const handleInstanceAction = async (instanceId: string | null, action: string) => {
    if (!instanceId) return;
    const success = await performAction(instanceId, action as 'start' | 'stop');
    if (success) {
      // Refresh overview after action
      setTimeout(refresh, 2000);
      setConfirmTerminate(null);
    }
  };

  return (
    <div className="space-y-4">
      <AdminCard icon={CloudIcon} title="AWS Overview" color="from-cyan-500 to-cyan-600">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-300">
              Region: <span className="text-white">{overview?.region || 'Not set'}</span>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-4 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-sm text-white hover:bg-slate-700/60 transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {displayError && <div className="text-sm text-red-400">{displayError}</div>}

          {!displayError && overview && !overview.region && (
            <div className="text-sm text-amber-300">
              AWS region not configured. Add credentials in Configuration.
            </div>
          )}

          {!displayError && overview && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Account</div>
                <div className="text-sm text-white mt-2">
                  {overview.identity?.account || 'Unknown'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {overview.identity?.arn || 'ARN unavailable'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Instances</div>
                <div className="text-2xl font-semibold text-white mt-2">{counts.total}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {stateBadges.length === 0 && (
                    <span className="text-xs text-slate-500">No instance data</span>
                  )}
                  {stateBadges.map(([state, count]) => (
                    <span
                      key={state}
                      className="text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-200"
                    >
                      {state}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Credentials</div>
                <div className="text-sm text-white mt-2">
                  {overview.configured ? 'Configured' : 'Not configured'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Manage in Configuration tab</div>
              </div>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard icon={CloudIcon} title="EC2 Instances" color="from-slate-500 to-slate-600">
        <div className="space-y-4">
          {loading && <div className="text-sm text-slate-400">Loading instances...</div>}
          {!loading && instances.length === 0 && (
            <div className="text-sm text-slate-400">No instances found.</div>
          )}
          {!loading && instances.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-300">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/60">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Instance ID</th>
                    <th className="py-2 pr-4">State</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Public IP</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((instance, _index) => {
                    const isLoading = actionLoading === instance.instanceId;
                    const isRunning = instance.state === 'running';
                    const isStopped = instance.state === 'stopped';
                    const showTerminate = confirmTerminate === instance.instanceId;

                    if (!instance.instanceId) return null;

                    return (
                      <tr key={instance.instanceId} className="border-b border-slate-800/60">
                        <td className="py-2 pr-4 text-white">{instance.name || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {instance.instanceId || '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              isRunning
                                ? 'bg-green-900/40 text-green-300'
                                : isStopped
                                  ? 'bg-slate-800/60 text-slate-400'
                                  : 'bg-amber-900/40 text-amber-300'
                            }`}
                          >
                            {instance.state || '—'}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{instance.instanceType || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{instance.publicIp || '—'}</td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() =>
                                setSsmInstanceId(
                                  ssmInstanceId === instance.instanceId ? null : instance.instanceId
                                )
                              }
                              className={`px-2 py-1 rounded text-xs ${
                                ssmInstanceId === instance.instanceId
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-purple-900/40 text-purple-300 hover:bg-purple-800/60'
                              }`}
                              title="Open SSM Terminal"
                            >
                              SSM
                            </button>
                            {isRunning && (
                              <>
                                <button
                                  onClick={() =>
                                    handleInstanceAction(instance.instanceId, 'reboot')
                                  }
                                  disabled={isLoading}
                                  className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs hover:bg-blue-800/60 disabled:opacity-50"
                                  title="Reboot"
                                >
                                  Reboot
                                </button>
                                <button
                                  onClick={() => handleInstanceAction(instance.instanceId, 'stop')}
                                  disabled={isLoading}
                                  className="px-2 py-1 bg-amber-900/40 text-amber-300 rounded text-xs hover:bg-amber-800/60 disabled:opacity-50"
                                  title="Stop"
                                >
                                  Stop
                                </button>
                              </>
                            )}
                            {isStopped && (
                              <button
                                onClick={() => handleInstanceAction(instance.instanceId, 'start')}
                                disabled={isLoading}
                                className="px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs hover:bg-green-800/60 disabled:opacity-50"
                                title="Start"
                              >
                                Start
                              </button>
                            )}
                            {!showTerminate && (
                              <button
                                onClick={() => setConfirmTerminate(instance.instanceId)}
                                disabled={isLoading}
                                className="px-2 py-1 bg-red-900/40 text-red-300 rounded text-xs hover:bg-red-800/60 disabled:opacity-50"
                                title="Terminate (permanent)"
                              >
                                Terminate
                              </button>
                            )}
                            {showTerminate && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    handleInstanceAction(instance.instanceId, 'terminate')
                                  }
                                  disabled={isLoading}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                                  title="Confirm termination"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmTerminate(null)}
                                  disabled={isLoading}
                                  className="px-2 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-600"
                                  title="Cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ssmInstanceId && (
            <SsmTerminal instanceId={ssmInstanceId} onClose={() => setSsmInstanceId(null)} />
          )}
        </div>
      </AdminCard>
    </div>
  );
};
