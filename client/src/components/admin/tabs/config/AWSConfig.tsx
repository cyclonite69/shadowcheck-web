import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SavedValueInput } from './SavedValueInput';

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
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

interface AWSConfigProps {
  awsRegion: string;
  setAwsRegion: (val: string) => void;
  savedAwsRegion: string;
  awsAccessKeyId: string;
  setAwsAccessKeyId: (val: string) => void;
  savedAwsAccessKeyId: string;
  awsSecretAccessKey: string;
  setAwsSecretAccessKey: (val: string) => void;
  savedAwsSecretAccessKey: string;
  isSaving: boolean;
  onSave: () => void;
  hasChanges: boolean;
}

export const AWSConfig: React.FC<AWSConfigProps> = ({
  awsRegion,
  setAwsRegion,
  savedAwsRegion,
  awsAccessKeyId,
  setAwsAccessKeyId,
  savedAwsAccessKeyId,
  awsSecretAccessKey,
  setAwsSecretAccessKey,
  savedAwsSecretAccessKey,
  isSaving,
  onSave,
  hasChanges,
}) => (
  <AdminCard title="AWS Configuration" icon={CloudIcon} color="from-orange-500 to-amber-500">
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Region</label>
        <SavedValueInput
          actualValue={awsRegion}
          savedValue={savedAwsRegion}
          onChange={setAwsRegion}
          placeholder="us-east-1"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-orange-500/50 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Access Key ID</label>
        <SavedValueInput
          actualValue={awsAccessKeyId}
          savedValue={savedAwsAccessKeyId}
          onChange={setAwsAccessKeyId}
          sensitive={true}
          placeholder="AKIA..."
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-orange-500/50 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Secret Access Key</label>
        <SavedValueInput
          actualValue={awsSecretAccessKey}
          savedValue={savedAwsSecretAccessKey}
          onChange={setAwsSecretAccessKey}
          sensitive={true}
          placeholder="Secret Key"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-orange-500/50 transition-colors"
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges}
        className={`w-full py-2.5 rounded-lg font-medium transition-all ${
          hasChanges
            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save AWS Settings'}
      </button>
    </div>
  </AdminCard>
);
