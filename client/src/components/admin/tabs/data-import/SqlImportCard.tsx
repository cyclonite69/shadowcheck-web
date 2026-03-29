import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { UploadIcon } from './UploadIcon';
import { ImportStatusMessage } from './ImportStatusMessage';
import { BackupCheckbox } from './BackupCheckbox';
import { FileImportButton } from './FileImportButton';

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

      <BackupCheckbox
        enabled={backupEnabled}
        onToggle={onToggleBackup}
        disabled={isLoading}
        label="Back up database before SQL import"
        accentColor="accent-green-500"
      />

      <FileImportButton
        id="sql-upload"
        accept=".sql"
        onChange={onFileChange}
        disabled={isLoading}
        isLoading={isLoading}
        loadingText={sqlImportStatus.startsWith('Running') ? 'Backing up...' : 'Running SQL...'}
        idleText="Choose SQL File"
        activeColorClass="from-green-600 to-green-700 hover:from-green-500 hover:to-green-600"
      />

      <ImportStatusMessage status={sqlImportStatus} />

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
        <p>Accepted file type: `.sql`</p>
        <p>Executed with `psql -v ON_ERROR_STOP=1`.</p>
      </div>
    </div>
  </AdminCard>
);
