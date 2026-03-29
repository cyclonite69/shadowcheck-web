import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SourceTagInput } from '../../components/SourceTagInput';
import { UploadIcon } from './UploadIcon';
import { ImportStatusMessage } from './ImportStatusMessage';
import { BackupCheckbox } from './BackupCheckbox';
import { FileImportButton } from './FileImportButton';

interface SQLiteImportCardProps {
  backupEnabled: boolean;
  canImport: boolean;
  importStatus: string;
  isLoading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBackup: (enabled: boolean) => void;
  setSourceTag: (value: string) => void;
  showKismetSuggestion: boolean;
  sourceTag: string;
}

export const SQLiteImportCard = ({
  backupEnabled,
  canImport,
  importStatus,
  isLoading,
  onFileChange,
  onToggleBackup,
  setSourceTag,
  showKismetSuggestion,
  sourceTag,
}: SQLiteImportCardProps) => (
  <AdminCard
    icon={UploadIcon}
    title="SQLite / Kismet Import"
    color={showKismetSuggestion ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'}
  >
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Import observations from WiGLE SQLite backups or native Kismet sidecar files.
      </p>

      {showKismetSuggestion && (
        <div className="p-2 bg-purple-900/30 border border-purple-500/50 rounded-lg text-xs text-purple-300 animate-pulse">
          ✨ <strong>Kismet File Detected:</strong> Data will be imported into forensic sidecar
          tables (app.kismet_*) automatically.
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">
          Source Tag / Session ID <span className="text-slate-500">(unique identifier)</span>
        </label>
        <SourceTagInput value={sourceTag} onChange={setSourceTag} disabled={isLoading} />
      </div>

      <BackupCheckbox
        enabled={backupEnabled}
        onToggle={onToggleBackup}
        disabled={isLoading}
        accentColor="accent-orange-500"
      />

      <FileImportButton
        id="sqlite-upload"
        accept=".sqlite,.db,.sqlite3,.kismet"
        onChange={onFileChange}
        disabled={!canImport}
        isLoading={isLoading}
        loadingText={importStatus.startsWith('Running') ? 'Backing up...' : 'Importing...'}
        idleText={`Choose ${showKismetSuggestion ? 'Kismet' : 'SQLite'} File`}
        activeColorClass={
          showKismetSuggestion
            ? 'from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600'
            : 'from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600'
        }
      />

      <ImportStatusMessage status={importStatus} />
    </div>
  </AdminCard>
);
