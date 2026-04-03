import { useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import type { DataImportResult } from '../tabs/data-import/types';

export const useDataImport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [sqlImportStatus, setSqlImportStatus] = useState('');
  const [kmlImportStatus, setKmlImportStatus] = useState('');
  const [sourceTag, setSourceTag] = useState('');
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [lastResult, setLastResult] = useState<DataImportResult | null>(null);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!sourceTag.trim()) {
      setImportStatus('Error: Please enter a source tag before choosing a file.');
      return;
    }

    const formData = new FormData();
    formData.append('database', file);
    formData.append('source_tag', sourceTag.trim());
    formData.append('backup', String(backupEnabled));

    try {
      setIsLoading(true);
      setLastResult(null);
      setImportStatus(
        backupEnabled ? 'Running pre-import backup...' : 'Uploading and importing...'
      );
      const result = await adminApi.importSQLite(formData);
      setLastResult(result);
      setImportStatus(
        result.ok
          ? `Imported ${(result.imported ?? 0).toLocaleString()} observations (${result.failed ?? 0} failed)`
          : `Failed: ${result.error || 'Unknown error'}`
      );
    } catch {
      setImportStatus('Import failed: Network error');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleSqlFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('sql_file', file);
    formData.append('backup', String(backupEnabled));
    formData.append('source_tag', sourceTag.trim() || 'sql_upload');

    try {
      setIsLoading(true);
      setLastResult(null);
      setSqlImportStatus(
        backupEnabled ? 'Running pre-import backup...' : 'Uploading and executing SQL...'
      );
      const result = await adminApi.importSQL(formData);
      setLastResult(result);
      setSqlImportStatus(
        result.ok ? result.message || 'SQL import complete' : `Failed: ${result.error}`
      );
    } catch {
      setSqlImportStatus('SQL import failed: Network error');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleKmlImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
    mode: 'files' | 'folder'
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const formData = new FormData();
    const relativePaths = files.map(
      (file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    );

    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('source_type', 'wigle');
    formData.append('upload_to_s3', 'true');
    formData.append('relative_paths', JSON.stringify(relativePaths));

    try {
      setIsLoading(true);
      setLastResult(null);
      setKmlImportStatus(
        mode === 'folder'
          ? 'Uploading folder to S3 and importing...'
          : 'Uploading KML files to S3 and importing...'
      );
      const result = await adminApi.importKml(formData);
      setLastResult(result);
      setKmlImportStatus(
        result.ok
          ? `Imported ${Number(result.filesImported || files.length).toLocaleString()} KML file(s) into ${Number(result.pointsImported || 0).toLocaleString()} staged points`
          : `Failed: ${result.error || 'Unknown error'}`
      );
    } catch {
      setKmlImportStatus('KML import failed: Network error');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  return {
    isLoading,
    importStatus,
    sqlImportStatus,
    kmlImportStatus,
    sourceTag,
    setSourceTag,
    backupEnabled,
    setBackupEnabled,
    lastResult,
    handleFileImport,
    handleSqlFileImport,
    handleKmlImport,
  };
};
