import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useDataImport } from '../hooks/useDataImport';

const UploadIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const DataImportTab: React.FC = () => {
  const { isLoading, importStatus, handleFileImport } = useDataImport();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <AdminCard icon={UploadIcon} title="SQLite Import" color="from-orange-500 to-orange-600">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Import networks from SQLite database files</p>
          <input
            id="sqlite-upload"
            type="file"
            accept=".sqlite,.db,.sqlite3"
            onChange={handleFileImport}
            disabled={isLoading}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-orange-600 file:text-white hover:file:bg-orange-700 text-sm"
          />
          {importStatus && (
            <div
              className={`p-3 rounded-lg text-sm ${
                importStatus.includes('Imported')
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}
            >
              {importStatus}
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard icon={UploadIcon} title="CSV Import" color="from-green-500 to-green-600">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Import networks from CSV files</p>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white hover:file:bg-green-700 text-sm"
          />
        </div>
      </AdminCard>
    </div>
  );
};
