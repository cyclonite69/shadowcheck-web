import React, { DragEvent, ChangeEvent, RefObject } from 'react';

export interface VisIntDropzoneProps {
  selectedFile: File | null;
  previewUrl: string | null;
  isDragOver: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  triggerFileInput: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  maxUploadMb: number;
  clearSelectedImageState: () => void;
  setError: (err: string | null) => void;
  setErrorType: (errType: string | null) => void;
}

export const VisIntDropzone: React.FC<VisIntDropzoneProps> = ({
  selectedFile,
  previewUrl,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  triggerFileInput,
  fileInputRef,
  onFileInputChange,
  maxUploadMb,
  clearSelectedImageState,
  setError,
  setErrorType,
}) => {
  return (
    <>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={triggerFileInput}
        className={`flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-cyan-500 bg-cyan-950/20'
            : 'border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileInputChange}
          accept="image/jpeg,image/png,video/mp4"
          className="hidden"
        />
        {previewUrl ? (
          <div className="relative w-full h-full p-3 flex items-center justify-center">
            {selectedFile?.type === 'video/mp4' ? (
              <video
                controls
                src={previewUrl}
                title="Telemetry upload preview"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Telemetry upload preview"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3 p-6 text-center">
            <div className="p-3 bg-slate-800/80 rounded-full text-slate-400">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
            </div>
            <div className="text-sm font-semibold text-slate-300">
              Drag and drop tactical media, or <span className="text-cyan-400">browse</span>
            </div>
            <div className="text-xs text-slate-500">
              Supports JPEG, PNG, and MP4 up to {maxUploadMb}MB
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between text-xs bg-slate-950/40 p-3 rounded-lg border border-slate-800">
          <div
            className="truncate font-mono text-slate-300 max-w-[200px]"
            title={selectedFile.name}
          >
            {selectedFile.name}
          </div>
          <div className="text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
          <button
            type="button"
            onClick={() => {
              clearSelectedImageState();
              setError(null);
              setErrorType(null);
            }}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
};
