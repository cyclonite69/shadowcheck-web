import { useState } from 'react';
import { adminApi } from '../../../api/adminApi';

export const useDataImport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('database', file);
    try {
      setIsLoading(true);
      setImportStatus('Uploading...');
      const response = await adminApi.importSQLite(formData);
      const result = await response.json();
      const errorMsg =
        typeof result.error === 'string' ? result.error : result.error?.message || 'Unknown error';
      setImportStatus(
        response.ok ? `Imported ${result.imported || 0} networks` : `Failed: ${errorMsg}`
      );
    } catch {
      setImportStatus('Import failed: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    importStatus,
    handleFileImport,
  };
};
