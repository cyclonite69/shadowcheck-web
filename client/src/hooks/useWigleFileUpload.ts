import { useState, useCallback } from 'react';
import { wigleApi } from '../api/wigleApi';

interface UseWigleFileUploadReturn {
  uploadError: string | null;
  uploadSuccess: string | null;
  uploading: boolean;
  uploadFile: (file: File) => Promise<string | null>;
  reset: () => void;
}

export function useWigleFileUpload(): UseWigleFileUploadReturn {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await wigleApi.importWigleV3(formData);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Upload failed');
      }

      const networkId = json.data.networkId;
      setUploadSuccess(`Imported: ${json.data.ssid || networkId}`);
      return networkId;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploadError(null);
    setUploadSuccess(null);
  }, []);

  return {
    uploadError,
    uploadSuccess,
    uploading,
    uploadFile,
    reset,
  };
}
