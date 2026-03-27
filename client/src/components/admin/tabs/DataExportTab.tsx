import React from 'react';
import { AdminCard } from '../components/AdminCard';

const DownloadIcon = ({ size = 24, className = '' }) => (
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
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const DataExportTab: React.FC = () => {
  const [exporting, setExporting] = React.useState<string | null>(null);

  const handleDownload = async (endpoint: string, filename: string, type: string) => {
    if (exporting) return;
    setExporting(type);
    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMsg = `Export failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // Use default error msg
        }
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      alert(`Failed to export data: ${error.message || 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Network Exports */}
      <AdminCard icon={DownloadIcon} title="Network Exports" color="from-blue-500 to-blue-600">
        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-4">
            Export scanned networks in multiple formats for analysis and integration.
          </p>
          <button
            onClick={() =>
              handleDownload('/api/csv', `shadowcheck_observations_${Date.now()}.csv`, 'csv')
            }
            disabled={!!exporting}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'csv' ? 'Generating CSV...' : 'Export as CSV'}
          </button>
          <button
            onClick={() =>
              handleDownload('/api/json', `shadowcheck_data_${Date.now()}.json`, 'json')
            }
            disabled={!!exporting}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium hover:from-slate-500 hover:to-slate-600 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'json' ? 'Generating JSON...' : 'Export as JSON'}
          </button>
        </div>
      </AdminCard>

      {/* Geospatial Export */}
      <AdminCard icon={DownloadIcon} title="Geospatial Export" color="from-green-500 to-green-600">
        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-4">
            Export observation data in GeoJSON format compatible with GIS tools and mapping
            applications.
          </p>
          <button
            onClick={() =>
              handleDownload(
                '/api/geojson',
                `shadowcheck_geospatial_${Date.now()}.geojson`,
                'geojson'
              )
            }
            disabled={!!exporting}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'geojson' ? 'Generating GeoJSON...' : 'Export as GeoJSON'}
          </button>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            <p className="mt-2">Compatible with:</p>
            <p>• QGIS, ArcGIS</p>
            <p>• Leaflet, Mapbox</p>
          </div>
        </div>
      </AdminCard>

      <AdminCard
        icon={DownloadIcon}
        title="Full Database Export"
        color="from-amber-500 to-amber-600"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-4">
            Export the full <code>app</code> schema as JSON. This includes all application tables,
            not just the observation/network subset used by the lighter exports.
          </p>
          <button
            onClick={() =>
              handleDownload(
                '/api/json/full',
                `shadowcheck_full_app_schema_${Date.now()}.json`,
                'full-json'
              )
            }
            disabled={!!exporting}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-medium hover:from-amber-500 hover:to-amber-600 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === 'full-json' ? 'Generating Full Export...' : 'Export Full Database JSON'}
          </button>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            <p>Admin only.</p>
            <p>Large datasets may take longer and produce a large file.</p>
          </div>
        </div>
      </AdminCard>
    </div>
  );
};
