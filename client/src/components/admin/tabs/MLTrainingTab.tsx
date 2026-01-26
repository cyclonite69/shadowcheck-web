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
  const { mlStatus, mlLoading, mlResult, loadMLStatus, trainModel } = useMLTraining();

  useEffect(() => {
    loadMLStatus();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      <AdminCard icon={BrainIcon} title="Train Model" color="from-pink-500 to-pink-600">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Train machine learning model for threat detection
          </p>
          <button
            onClick={trainModel}
            disabled={mlLoading}
            className="w-full p-3 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 disabled:opacity-50 text-white font-medium"
          >
            {mlLoading ? '🔄 Training...' : '🧠 Train Model'}
          </button>
          {mlResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                mlResult.type === 'success'
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}
            >
              {mlResult.message}
            </div>
          )}
          <div className="text-xs text-slate-500 space-y-1">
            <p>• Requires 10+ tagged networks</p>
            <p>• Uses logistic regression</p>
            <p>• Training takes 5-30 seconds</p>
          </div>
        </div>
      </AdminCard>

      <AdminCard icon={BarChartIcon} title="Training Data" color="from-purple-500 to-purple-600">
        <div className="space-y-3">
          {mlStatus?.taggedNetworks?.length > 0 ? (
            <>
              {mlStatus.taggedNetworks.map((tag: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2 bg-slate-800/50 rounded-lg"
                >
                  <span className="text-sm text-white capitalize">
                    {tag.tag_type.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-blue-400">{tag.count}</span>
                </div>
              ))}
              <div className="p-2 bg-slate-700/50 rounded-lg">
                <span className="text-xs text-slate-300">
                  Total: {mlStatus.taggedNetworks.reduce((s: number, t: any) => s + t.count, 0)}{' '}
                  tagged
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 py-6">
              <p className="text-sm">No tagged networks</p>
              <p className="text-xs mt-1">Tag networks to enable training</p>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard icon={TargetIcon} title="Model Status" color="from-cyan-500 to-cyan-600">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Status:</span>
            <span
              className={`text-sm font-medium ${
                mlStatus?.modelTrained ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {mlStatus?.modelTrained ? 'Trained' : 'Not Trained'}
            </span>
          </div>
          {mlStatus?.modelInfo?.updated_at && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-300">Updated:</span>
              <span className="text-sm text-slate-400">
                {new Date(mlStatus.modelInfo.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Algorithm:</span>
            <span className="text-sm text-slate-400">Logistic Regression</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Features:</span>
            <span className="text-sm text-slate-400">7 behavioral</span>
          </div>
        </div>
      </AdminCard>
    </div>
  );
};
