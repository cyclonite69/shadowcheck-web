import { useState } from 'react';

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
      const response = await fetch('/api/admin/import-sqlite', { method: 'POST', body: formData });
      const result = await response.json();
      setImportStatus(
        response.ok
          ? `Imported ${result.imported || 0} networks`
          : `Failed: ${result.error || 'Unknown error'}`
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
