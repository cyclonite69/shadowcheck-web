import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { apiClient } from '../../api/client';
import { VisIntDropzone } from './uploader/VisIntDropzone';
import { VisIntParamTuning } from './uploader/VisIntParamTuning';
import { VisIntExifSummary } from './uploader/VisIntExifSummary';
import { VisIntCandidatesTable, CandidateObservation } from './uploader/VisIntCandidatesTable';
import { VisIntSavedBanner } from './uploader/VisIntSavedBanner';
import { getPreviewTags } from './uploader/visintTagRules';

interface VisIntResult {
  status: 'MATCHED' | 'UNMATCHED';
  observation_id: string | null;
  detection_score: number;
  dist_meters: number | null;
  delta_minutes: number | null;
  tags_applied: string[];
  exif: { lat: number; lon: number; ts: string };
  candidates?: CandidateObservation[];
}

const VISINT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const VISINT_UPLOAD_MAX_MB = VISINT_UPLOAD_MAX_BYTES / (1024 * 1024);

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const apiError = err as {
    message?: string;
    data?: { error?: unknown; message?: unknown };
    response?: { data?: { error?: unknown; message?: unknown } };
  };
  const rawMessage =
    apiError.response?.data?.error ||
    apiError.response?.data?.message ||
    apiError.data?.error ||
    apiError.data?.message ||
    apiError.message ||
    fallback;

  return typeof rawMessage === 'string' ? rawMessage : fallback;
};

export default function VisIntUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisIntResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Interaction Flow State
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveTags, setSaveTags] = useState<string[]>([]);

  // Custom Search Bounds
  const [radiusMeters, setRadiusMeters] = useState<number>(50);
  const [windowHours, setWindowHours] = useState<number>(2);
  const [limit, setLimit] = useState<number>(5);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearCorrelationState = () => {
    setResult(null);
    setSelectedCandidateId(null);
    setSaveSuccess(false);
    setSaveTags([]);
  };

  const clearSelectedImageState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    clearCorrelationState();
  };

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      clearSelectedImageState();
      setError('Please select a valid image file (JPEG or PNG).');
      setErrorType(null);
      return;
    }
    if (file.size > VISINT_UPLOAD_MAX_BYTES) {
      clearSelectedImageState();
      setError(`VISINT images must be ${VISINT_UPLOAD_MAX_MB} MB or smaller.`);
      setErrorType('PayloadTooLarge');
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    clearCorrelationState();
    setError(null);
    setErrorType(null);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setErrorType(null);
    setSaveSuccess(false);
    setSaveTags([]);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('filename', selectedFile.name);
      formData.append('commit', 'false');
      formData.append('radius_meters', String(radiusMeters));
      formData.append('window_hours', String(windowHours));
      formData.append('limit', String(limit));

      const response = await apiClient.post<{ ok: boolean } & VisIntResult>(
        '/observations/correlate-visint',
        formData
      );

      setResult(response);

      // Auto-select the best candidate match (first in list) if it exists, otherwise fallback to unmatched
      if (response.candidates && response.candidates.length > 0) {
        setSelectedCandidateId(String(response.candidates[0].id));
      } else {
        setSelectedCandidateId('unmatched');
      }
    } catch (err: any) {
      console.error(err);
      setError(getApiErrorMessage(err, 'An error occurred during upload.'));
      if (
        err.response?.data?.type === 'ExifMissingError' ||
        err.data?.type === 'ExifMissingError'
      ) {
        setErrorType('ExifMissingError');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveCorrelation = async () => {
    if (!selectedFile || !result || !selectedCandidateId) return;

    setSaveLoading(true);
    setError(null);

    try {
      const isUnmatched = selectedCandidateId === 'unmatched';
      const candidate = result.candidates?.find((c) => String(c.id) === selectedCandidateId);
      // manual_override = true when the user picked a different candidate than the scorer's auto-top-pick
      const autoTopId = result.candidates?.[0] ? String(result.candidates[0].id) : null;
      const isManualOverride = !isUnmatched && selectedCandidateId !== autoTopId;

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('filename', selectedFile.name);
      formData.append(
        'bssid',
        isUnmatched ? 'VISINT_UNMATCHED' : candidate?.bssid || 'VISINT_UNMATCHED'
      );
      formData.append('status', isUnmatched ? 'UNMATCHED' : 'MATCHED');
      formData.append(
        'detection_score',
        String(isUnmatched ? 0 : Number(candidate?.detection_score || 0))
      );
      formData.append('manual_override', String(isManualOverride));
      if (candidate?.device_type) {
        formData.append('device_type', candidate.device_type);
      }
      if (isUnmatched) {
        formData.append('confirm_fallback', 'true');
      }
      if (!isUnmatched) {
        formData.append('dist_meters', String(Number(candidate?.dist_meters || 0)));
        formData.append('delta_minutes', String(Number(candidate?.delta_minutes || 0)));
        formData.append('observation_id', selectedCandidateId);
      }
      formData.append('lat', String(result.exif.lat));
      formData.append('lon', String(result.exif.lon));
      formData.append('ts', result.exif.ts);

      const response = await apiClient.post<{
        ok: boolean;
        success: boolean;
        tags_applied: string[];
      }>('/observations/attach-visint', formData);

      if (response.success) {
        setSaveSuccess(true);
        setSaveTags(response.tags_applied);
      }
    } catch (err: any) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Failed to save correlation.'));
    } finally {
      setSaveLoading(false);
    }
  };

  const selectedBssid =
    selectedCandidateId === 'unmatched'
      ? 'VISINT_UNMATCHED'
      : result?.candidates?.find((c) => String(c.id) === selectedCandidateId)?.bssid ||
        'VISINT_UNMATCHED';

  const previewTags = getPreviewTags(selectedCandidateId, result?.candidates);

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 text-slate-100 shadow-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          VisINT Auto-Correlation Pipeline
        </h2>
        <p className="text-sm text-slate-400">
          Upload tactical SIGINT images to extract EXIF telemetry and execute spatial-temporal
          correlation queries against core observations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload Column */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          <VisIntDropzone
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            isDragOver={isDragOver}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            triggerFileInput={triggerFileInput}
            fileInputRef={fileInputRef}
            onFileInputChange={onFileInputChange}
            maxUploadMb={VISINT_UPLOAD_MAX_MB}
            clearSelectedImageState={clearSelectedImageState}
            setError={setError}
            setErrorType={setErrorType}
          />

          {selectedFile && (
            <div className="flex flex-col space-y-3">
              {!result && (
                <VisIntParamTuning
                  radiusMeters={radiusMeters}
                  setRadiusMeters={setRadiusMeters}
                  windowHours={windowHours}
                  setWindowHours={setWindowHours}
                  limit={limit}
                  setLimit={setLimit}
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                />
              )}

              {!result && (
                <button
                  type="button"
                  onClick={uploadFile}
                  disabled={loading}
                  className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 font-semibold transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Analyzing Telemetry...</span>
                    </div>
                  ) : (
                    <span>Search Matching Observations</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7 flex flex-col justify-start">
          {error && (
            <div
              className={`p-4 rounded-xl border flex flex-col space-y-2 mb-4 ${
                errorType === 'ExifMissingError'
                  ? 'bg-amber-950/20 border-amber-900/60 text-amber-200'
                  : 'bg-red-950/20 border-red-900/60 text-red-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="font-semibold text-sm">
                  {errorType === 'ExifMissingError'
                    ? 'Telemetry Payload Rejected'
                    : 'Pipeline Error'}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">{error}</p>
            </div>
          )}

          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-64 border border-slate-800/80 rounded-xl bg-slate-950/20 text-slate-500">
              <svg
                className="w-12 h-12 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <div className="text-sm font-semibold">Ready for Telemetry Payload</div>
              <div className="text-xs mt-1">
                Upload a tactical capture to search corresponding physical observations.
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 border border-slate-800/80 rounded-xl bg-slate-950/20 text-slate-400">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin" />
              </div>
              <div className="text-sm font-semibold">Processing Pipeline</div>
              <div className="text-xs text-slate-500 mt-1">
                Executing exiftool & performing spatial-temporal casts
              </div>
            </div>
          )}

          {result && saveSuccess && (
            <VisIntSavedBanner
              selectedBssid={selectedBssid}
              selectedCandidateId={selectedCandidateId}
              saveTags={saveTags}
              onReset={() => {
                clearSelectedImageState();
                setError(null);
                setErrorType(null);
              }}
            />
          )}

          {result && !saveSuccess && (
            <div className="flex flex-col space-y-4 p-5 rounded-xl border border-slate-800 bg-slate-950/30">
              <VisIntExifSummary
                candidatesCount={result.candidates?.length || 0}
                exif={result.exif}
              />

              {/* Candidates Selection Table */}
              <VisIntCandidatesTable
                candidates={result.candidates}
                selectedCandidateId={selectedCandidateId}
                setSelectedCandidateId={setSelectedCandidateId}
              />

              {/* Action Commit Summary */}
              <div className="bg-slate-900/40 border border-slate-800 p-3 rounded-lg flex flex-col space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Correlation preview
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {selectedCandidateId === 'unmatched' ? (
                    <span>
                      Photo will be logged as unmatched telemetry. It will attach to fallback BSSID{' '}
                      <strong className="font-mono text-amber-400">VISINT_UNMATCHED</strong> and be
                      tagged with:
                    </span>
                  ) : (
                    <span>
                      Photo will be attached to BSSID:{' '}
                      <strong className="font-mono text-cyan-300">{selectedBssid}</strong> and be
                      tagged with:
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {previewTags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono font-bold"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={saveCorrelation}
                disabled={saveLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 font-semibold transition-all duration-200 text-sm shadow-md"
              >
                {saveLoading ? 'Saving Correlation...' : 'Confirm & Save Correlation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
