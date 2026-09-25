import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatShortDate, formatISODate } from '../../../utils/formatDate';
import { formatDeviceType } from '../../../utils/deviceClassUtils';
import { apiClient } from '../../../api/client';

// ─── Event bus (mirrors VendorIntelDrawer pattern) ────────────────────────────

export const DETECTION_EVIDENCE_EVENT = 'detection-evidence-open';

export function emitDetectionEvidence(bssid: string, ssid?: string | null): void {
  window.dispatchEvent(new CustomEvent(DETECTION_EVIDENCE_EVENT, { detail: { bssid, ssid } }));
}

interface DetectionRecord {
  device_type: string;
  confidence: number;
  threat_score: number;
  detected_at: string;
  detection_method: string;
  matched_signals: any;
  false_positive: boolean;
  fp_reason: string | null;
  notes: string | null;
  tags: string[] | null;
}

interface DetectionEvidenceModalProps {
  bssid: string;
  ssid?: string | null;
  onClose: () => void;
}

export const DetectionEvidenceModal: React.FC<DetectionEvidenceModalProps> = ({
  bssid,
  ssid,
  onClose,
}) => {
  const [detections, setDetections] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDetections = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<{ evidence: DetectionRecord[] }>(
          `/admin/networks/${encodeURIComponent(bssid)}/detection-evidence`
        );
        setDetections(data.evidence || []);
        setError(null);
      } catch (err: any) {
        // Re-throw auth-expiry errors so AuthProvider clears the session.
        if (err?.handled === true) {
          throw err;
        }
        console.error('Failed to fetch detection evidence:', err);
        setError(err.message);
        setDetections([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDetections();
  }, [bssid]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!modalRef.current) {
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Return null if no detections (silent empty state)
  if (!loading && detections.length === 0 && !error) {
    return null;
  }

  const title = ssid ? `Detection Evidence — ${ssid}` : `Detection Evidence — ${bssid}`;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
    >
      <div
        ref={modalRef}
        style={{
          position: 'relative',
          background: '#1e293b',
          border: '1px solid #475569',
          borderRadius: '8px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          width: '90%',
        }}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#0f172a',
            borderBottom: '1px solid #475569',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10002,
          }}
        >
          <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: '16px', fontWeight: 600 }}>
            🛡️ {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>
          {loading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                color: '#64748b',
                fontSize: '13px',
                padding: '32px 16px',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #475569',
                  borderTopColor: '#0ea5e9',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Loading detection evidence...
            </div>
          )}

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                padding: '12px',
                color: '#ef4444',
                fontSize: '12px',
              }}
            >
              Error: {error}
            </div>
          )}

          {!loading && detections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {detections.map((detection, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '12px',
                  }}
                >
                  {/* Device Type */}
                  <div style={{ marginBottom: '8px' }}>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '4px',
                      }}
                    >
                      Device Type
                    </div>
                    <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {formatDeviceType(detection.device_type)}
                    </div>
                  </div>

                  {/* Confidence & Threat Score */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Confidence
                      </div>
                      <div style={{ color: '#e2e8f0' }}>
                        {Math.round((detection.confidence || 0) * 100)}%
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Threat Score
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{detection.threat_score || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Detection Method */}
                  {detection.detection_method && (
                    <div style={{ marginBottom: '8px' }}>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Detection Method
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{detection.detection_method}</div>
                    </div>
                  )}

                  {/* Matched Signals */}
                  {detection.matched_signals && (
                    <div style={{ marginBottom: '8px' }}>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Matched Signals
                      </div>
                      <div
                        style={{
                          color: '#cbd5e1',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          background: 'rgba(15, 23, 42, 0.5)',
                          padding: '6px',
                          borderRadius: '3px',
                          overflow: 'auto',
                          maxHeight: '80px',
                        }}
                      >
                        {typeof detection.matched_signals === 'object'
                          ? JSON.stringify(detection.matched_signals, null, 2)
                          : String(detection.matched_signals)}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {detection.tags && Array.isArray(detection.tags) && detection.tags.length > 0 && (
                    <div style={{ marginBottom: '0' }}>
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Tags
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {detection.tags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#3b82f6',
                              padding: '3px 8px',
                              borderRadius: '3px',
                              fontSize: '11px',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detected At */}
                  {detection.detected_at && (
                    <div
                      title={formatISODate(detection.detected_at)}
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #475569',
                        color: '#64748b',
                        fontSize: '11px',
                      }}
                    >
                      {formatShortDate(detection.detected_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>,
    document.body
  );
};

// ─── Global event-driven wrapper (mirrors VendorIntelDrawer mount pattern) ────

/**
 * Mount once in App.tsx. Listens for DETECTION_EVIDENCE_EVENT and renders
 * DetectionEvidenceModal without requiring local state at the call site.
 */
export const DetectionEvidenceGlobal: React.FC = () => {
  const [target, setTarget] = useState<{ bssid: string; ssid?: string | null } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { bssid, ssid } = (e as CustomEvent).detail as {
        bssid: string;
        ssid?: string | null;
      };
      setTarget({ bssid, ssid });
    };
    window.addEventListener(DETECTION_EVIDENCE_EVENT, handler);
    return () => window.removeEventListener(DETECTION_EVIDENCE_EVENT, handler);
  }, []);

  if (!target) {
    return null;
  }
  return (
    <DetectionEvidenceModal
      bssid={target.bssid}
      ssid={target.ssid}
      onClose={() => setTarget(null)}
    />
  );
};
