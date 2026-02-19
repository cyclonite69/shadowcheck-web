import React, { useEffect } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useMLTraining } from '../hooks/useMLTraining';

const BrainIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const BarChartIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const TargetIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const MLTrainingTab: React.FC = () => {
  const { mlStatus, mlLoading, mlResult, loadMLStatus, trainModel, recalculateScores } =
    useMLTraining();

  useEffect(() => {
    loadMLStatus();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Model Operations */}
      <AdminCard icon={BrainIcon} title="Model Operations" color="from-pink-500 to-pink-600">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Manage machine learning model for threat detection.
          </p>

          <div className="space-y-2">
            <button
              onClick={trainModel}
              disabled={mlLoading}
              className="w-full p-3 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 disabled:opacity-50 text-white font-medium text-sm transition-all"
            >
              {mlLoading ? 'Training...' : 'Train Model'}
            </button>
            <button
              onClick={() => recalculateScores(5000)}
              disabled={mlLoading || !mlStatus?.modelTrained}
              className="w-full p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 text-white font-medium text-sm border border-slate-700/60 transition-all"
            >
              {mlLoading ? 'Calculating...' : 'Recalculate Scores'}
            </button>
          </div>

          {mlResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                mlResult.type === 'success'
                  ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                  : 'bg-red-900/30 text-red-300 border border-red-700/50'
              }`}
            >
              {mlResult.message}
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1 pt-3 border-t border-slate-700/50">
            <p>✓ Requires 10+ tagged networks</p>
            <p>✓ Logistic regression algorithm</p>
            <p>✓ Training: 5-30 seconds</p>
          </div>
        </div>
      </AdminCard>

      {/* Training Data */}
      <AdminCard icon={BarChartIcon} title="Training Data" color="from-purple-500 to-purple-600">
        <div className="space-y-3">
          {mlStatus && mlStatus.taggedNetworks && mlStatus.taggedNetworks.length > 0 ? (
            <>
              {mlStatus.taggedNetworks.map((tag: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/30"
                >
                  <span className="text-sm text-slate-300 capitalize">
                    {tag.tag_type.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-semibold text-blue-400">{tag.count}</span>
                </div>
              ))}
              <div className="mt-3 p-2.5 bg-slate-700/30 rounded-lg border border-slate-700/50">
                <span className="text-xs text-slate-300">
                  Total:{' '}
                  <strong>
                    {mlStatus.taggedNetworks.reduce((s: number, t: any) => s + t.count, 0)}
                  </strong>{' '}
                  tagged
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <p className="text-sm">No tagged networks</p>
              <p className="text-xs mt-1">Tag networks to enable training</p>
            </div>
          )}
        </div>
      </AdminCard>

      {/* Model Status */}
      <AdminCard icon={TargetIcon} title="Model Status" color="from-cyan-500 to-cyan-600">
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-400">Status:</span>
            <span
              className={`text-sm font-semibold ${
                mlStatus?.modelTrained ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {mlStatus?.modelTrained ? 'Trained' : 'Untrained'}
            </span>
          </div>

          {mlStatus && mlStatus.modelInfo && mlStatus.modelInfo.updated_at && (
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-400">Updated:</span>
              <span className="text-sm text-slate-300">
                {new Date(mlStatus.modelInfo.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-400">Algorithm:</span>
            <span className="text-sm text-slate-300">Logistic Regression</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-400">Features:</span>
            <span className="text-sm text-slate-300">7 behavioral</span>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-700/50 text-xs text-slate-500">
            Performance metrics and detailed info available in logs.
          </div>
        </div>
      </AdminCard>
    </div>
  );
};
