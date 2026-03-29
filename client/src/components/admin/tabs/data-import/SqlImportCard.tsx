import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { UploadIcon } from './UploadIcon';

interface SqlImportCardProps {
  backupEnabled: boolean;
  isLoading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBackup: (enabled: boolean) => void;
  sqlImportStatus: string;
}

export const SqlImportCard = ({
  backupEnabled,
  isLoading,
  onFileChange,
  onToggleBackup,
  sqlImportStatus,
}: SqlImportCardProps) => (
  <AdminCard icon={UploadIcon} title="SQL Import" color="from-green-500 to-green-600">
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Upload and execute a PostgreSQL SQL script directly on EC2.
      </p>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={backupEnabled}
          onChange={(e) => onToggleBackup(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 rounded accent-green-500"
        />
        <span className="text-xs text-slate-400">Back up database before SQL import</span>
      </label>

      <label className="block">
        <input
          id="sql-upload"
          type="file"
          accept=".sql"
          onChange={onFileChange}
          disabled={isLoading}
          className="hidden"
        />
        <div
          className={`px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-all text-white bg-gradient-to-r from-green-600 to-green-700 ${
            isLoading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:from-green-500 hover:to-green-600 cursor-pointer'
          }`}
          onClick={() => !isLoading && document.getElementById('sql-upload')?.click()}
        >
          {isLoading
            ? sqlImportStatus.startsWith('Running')
              ? 'Backing up...'
              : 'Running SQL...'
            : 'Choose SQL File'}
        </div>
      </label>

      {sqlImportStatus && (
        <div
          className={`p-3 rounded-lg text-sm ${
            sqlImportStatus.toLowerCase().includes('complete')
              ? 'bg-green-900/30 text-green-300 border border-green-700/50'
              : 'bg-red-900/30 text-red-300 border border-red-700/50'
          }`}
        >
          {sqlImportStatus}
        </div>
      )}

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
        <p>Accepted file type: `.sql`</p>
        <p>Executed with `psql -v ON_ERROR_STOP=1`.</p>
      </div>
    </div>
  </AdminCard>
);
