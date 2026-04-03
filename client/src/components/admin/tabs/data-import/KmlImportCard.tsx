import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { UploadIcon } from './UploadIcon';
import { ImportStatusMessage } from './ImportStatusMessage';
import { FileImportButton } from './FileImportButton';

interface KmlImportCardProps {
  isLoading: boolean;
  kmlImportStatus: string;
  onFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const KmlImportCard = ({
  isLoading,
  kmlImportStatus,
  onFilesChange,
  onFolderChange,
}: KmlImportCardProps) => (
  <AdminCard icon={UploadIcon} title="KML Import" color="from-sky-500 to-cyan-600">
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Upload WiGLE KML exports into staged `app.kml_*` tables and copy the raw files to S3 for
        later reconciliation.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <FileImportButton
          id="kml-upload-files"
          accept=".kml"
          onChange={onFilesChange}
          disabled={isLoading}
          isLoading={isLoading}
          loadingText="Uploading KML..."
          idleText="Choose KML Files"
          activeColorClass="from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600"
          multiple
        />

        <FileImportButton
          id="kml-upload-folder"
          accept=".kml"
          onChange={onFolderChange}
          disabled={isLoading}
          isLoading={isLoading}
          loadingText="Uploading Folder..."
          idleText="Choose KML Folder"
          activeColorClass="from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600"
          multiple
          directory
        />
      </div>

      <ImportStatusMessage status={kmlImportStatus} />

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
        <p>Accepted file type: `.kml`</p>
        <p>Files are staged into `app.kml_files` and `app.kml_points`.</p>
      </div>
    </div>
  </AdminCard>
);
