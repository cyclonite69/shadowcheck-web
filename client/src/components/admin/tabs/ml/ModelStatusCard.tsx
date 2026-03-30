import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { formatShortDate } from '../../../../utils/formatDate';

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

interface ModelStatusCardProps {
  mlStatus: any;
}

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({ mlStatus }) => (
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
            {formatShortDate(mlStatus.modelInfo.updated_at)}
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
);
