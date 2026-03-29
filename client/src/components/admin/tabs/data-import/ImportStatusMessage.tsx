import React from 'react';

interface ImportStatusMessageProps {
  status: string;
}

export const ImportStatusMessage: React.FC<ImportStatusMessageProps> = ({ status }) => {
  if (!status) return null;

  const isSuccess =
    status.startsWith('Imported') ||
    status.toLowerCase().includes('complete') ||
    status.includes('successfully');

  return (
    <div
      className={`p-3 rounded-lg text-sm ${
        isSuccess
          ? 'bg-green-900/30 text-green-300 border border-green-700/50'
          : 'bg-red-900/30 text-red-300 border border-red-700/50'
      }`}
    >
      {status}
    </div>
  );
};
