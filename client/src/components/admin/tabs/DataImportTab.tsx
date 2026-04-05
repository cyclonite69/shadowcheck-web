import React, { useEffect, useState } from 'react';
import { useDataImport } from '../hooks/useDataImport';
import { ImportHistory } from './data-import/ImportHistory';
import { KmlImportCard } from './data-import/KmlImportCard';
import { LastImportAudit } from './data-import/LastImportAudit';
import { OrphanNetworksPanel } from './data-import/OrphanNetworksPanel';
import { SQLiteImportCard } from './data-import/SQLiteImportCard';
import { SqlImportCard } from './data-import/SqlImportCard';

export const DataImportTab: React.FC = () => {
  const {
    isLoading,
    importStatus,
    sqlImportStatus,
    kmlImportStatus,
    lastResult,
    sourceTag,
    setSourceTag,
    backupEnabled,
    setBackupEnabled,
    handleFileImport,
    handleSqlFileImport,
    handleKmlImport,
  } = useDataImport();
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!isLoading && (importStatus || sqlImportStatus || kmlImportStatus)) {
      setHistoryKey((k) => k + 1);
    }
  }, [isLoading, importStatus, sqlImportStatus, kmlImportStatus]);

  const canImport = !isLoading && sourceTag.trim().length > 0;

  // Smart Detect: Suggest Kismet mode if filename looks like a kismet file
  const [showKismetSuggestion, setShowKismetSuggestion] = useState(false);
  const handleFileSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.kismet')) {
      setShowKismetSuggestion(true);
    } else {
      setShowKismetSuggestion(false);
    }
    handleFileImport(e);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 gap-4">
        <SQLiteImportCard
          backupEnabled={backupEnabled}
          canImport={canImport}
          importStatus={importStatus}
          isLoading={isLoading}
          onFileChange={handleFileSelectionChange}
          onToggleBackup={setBackupEnabled}
          setSourceTag={setSourceTag}
          showKismetSuggestion={showKismetSuggestion}
          sourceTag={sourceTag}
        />
        <SqlImportCard
          backupEnabled={backupEnabled}
          isLoading={isLoading}
          onFileChange={handleSqlFileImport}
          onToggleBackup={setBackupEnabled}
          sqlImportStatus={sqlImportStatus}
        />
        <KmlImportCard
          isLoading={isLoading}
          kmlImportStatus={kmlImportStatus}
          onFilesChange={(event) => handleKmlImport(event, 'files')}
          onFolderChange={(event) => handleKmlImport(event, 'folder')}
        />
      </div>

      {lastResult && <LastImportAudit lastResult={lastResult} sourceTag={sourceTag} />}

      <OrphanNetworksPanel refreshKey={historyKey} />

      {/* Import History */}
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Import History{' '}
          <span className="text-slate-500 font-normal text-xs">— click a row for details</span>
        </h3>
        <ImportHistory refreshKey={historyKey} />
      </div>
    </div>
  );
};
