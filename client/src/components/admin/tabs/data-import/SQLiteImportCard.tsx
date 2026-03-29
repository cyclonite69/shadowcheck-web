import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SourceTagInput } from '../../components/SourceTagInput';
import { UploadIcon } from './UploadIcon';

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

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={backupEnabled}
          onChange={(e) => onToggleBackup(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 rounded accent-orange-500"
        />
        <span className="text-xs text-slate-400">Back up database before importing</span>
      </label>

      <label className="block">
        <input
          id="sqlite-upload"
          type="file"
          accept=".sqlite,.db,.sqlite3,.kismet"
          onChange={onFileChange}
          disabled={!canImport}
          className="hidden"
        />
        <div
          className={`px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-all text-white bg-gradient-to-r ${
            showKismetSuggestion
              ? 'from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600'
              : 'from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600'
          } ${canImport ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
          onClick={() => canImport && document.getElementById('sqlite-upload')?.click()}
        >
          {isLoading
            ? importStatus.startsWith('Running')
              ? 'Backing up...'
              : 'Importing...'
            : `Choose ${showKismetSuggestion ? 'Kismet' : 'SQLite'} File`}
        </div>
      </label>

      {importStatus && (
        <div
          className={`p-3 rounded-lg text-sm ${
            importStatus.startsWith('Imported') || importStatus.includes('Complete')
              ? 'bg-green-900/30 text-green-300 border border-green-700/50'
              : 'bg-red-900/30 text-red-300 border border-red-700/50'
          }`}
        >
          {importStatus}
        </div>
      )}
    </div>
  </AdminCard>
);
