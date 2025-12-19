import React, { useState, useEffect } from 'react';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;

interface MLStatus {
  modelTrained: boolean;
  taggedNetworks?: Array<{ tag_type: string; count: number }>;
  modelInfo?: { updated_at: string };
}

export default function MLTrainingPage() {
  const [status, setStatus] = useState<MLStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/ml/status`);
      const data = await res.json();

      if (data.error) {
        console.error('ML status error:', data.error);
        setStatus({
          modelTrained: false,
          taggedNetworks: [],
          modelInfo: undefined,
        });
        return;
      }

      setStatus(data);
    } catch (err) {
      console.error('Error loading status:', err);
    }
  };

  const trainModel = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/ml/train`, { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        setResult({
          type: 'success',
          message: `✓ Model Trained Successfully!\n\nTraining Samples: ${data.trainingSamples} (${data.threatCount} threats, ${data.safeCount} safe)\nFeatures: ${data.featureNames.join(', ')}\n\nCoefficients:\n${JSON.stringify(data.coefficients, null, 2)}`,
        });
        loadStatus();
      } else {
        throw new Error(data.error || 'Training failed');
      }
    } catch (err: any) {
      setResult({
        type: 'error',
        message: `✗ Training Failed\n${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const reassessNetworks = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/ml/reassess`, { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        setResult({
          type: 'success',
          message: `✓ Networks Reassessed Successfully!\nUpdated ${data.networksUpdated.toLocaleString()} networks with ML scores\nModel: ${data.modelUsed.type}`,
        });
        loadStatus();
      } else {
        throw new Error(data.error || 'Reassessment failed');
      }
    } catch (err: any) {
      setResult({
        type: 'error',
        message: `✗ Reassessment Failed\n${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const threatCount = status?.taggedNetworks?.find((t) => t.tag_type === 'THREAT')?.count || 0;
  const safeCount =
    status?.taggedNetworks?.find((t) => t.tag_type === 'FALSE_POSITIVE')?.count || 0;
  const total = threatCount + safeCount;
  const needMore = Math.max(0, 10 - total);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/60 shadow-2xl text-center mb-6">
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '900',
              margin: 0,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
              filter:
                'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 30px rgba(100, 116, 139, 0.3))',
            }}
          >
            ShadowCheck ML Training
          </h1>
          <p
            style={{
              fontSize: '12px',
              fontWeight: '300',
              margin: 0,
              marginTop: '4px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
              opacity: 0.8,
            }}
          >
            Machine learning training and threat assessment console
          </p>
        </div>

        {/* Current Status Panel */}
        <div
          className="mb-6"
          style={{
            background: '#0f1e34',
            opacity: 0.95,
            border: '1px solid #20324d',
            borderRadius: '12px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="p-4"
            style={{
              background: '#132744',
              borderBottom: '1px solid #1c3050',
              borderRadius: '12px 12px 0 0',
            }}
          >
            <h3 className="text-sm font-semibold text-white">Current Status</h3>
          </div>
          <div className="p-4 space-y-3">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Model Trained:</span>
              <span className="font-semibold">
                {status ? (status.modelTrained ? '✓ Yes' : '✗ No') : 'Loading...'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Tagged Threats:</span>
              <span className="font-semibold">{threatCount}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Tagged Safe:</span>
              <span className="font-semibold">{safeCount}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '6px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Last Updated:</span>
              <span className="font-semibold">
                {status?.modelInfo?.updated_at
                  ? new Date(status.modelInfo.updated_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* How It Works Panel */}
        <div
          style={{
            background: '#0f1e34',
            opacity: 0.95,
            border: '1px solid #20324d',
            borderRadius: '12px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="p-4"
            style={{
              background: '#132744',
              borderBottom: '1px solid #1c3050',
              borderRadius: '12px 12px 0 0',
            }}
          >
            <h3 className="text-sm font-semibold text-white">How It Works</h3>
          </div>
          <div className="p-4">
            <p
              style={{
                color: '#94a3b8',
                fontSize: '13px',
                lineHeight: '1.6',
                marginBottom: '16px',
              }}
            >
              The ML model analyzes your tagged networks (threats vs safe) and automatically learns
              which features (distance, signal strength, observation patterns) best predict real
              threats. It then generates optimized scoring weights that reduce false positives while
              maintaining detection accuracy.
            </p>

            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
              Features Used:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                📏 Distance Range
              </div>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                📅 Unique Days
              </div>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                👁️ Observations
              </div>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                📶 Signal Strength
              </div>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                📍 Unique Locations
              </div>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                🏠 Home+Away Pattern
              </div>
            </div>

            <button
              onClick={trainModel}
              disabled={loading || needMore > 0}
              style={{
                width: '100%',
                marginBottom: '10px',
                padding: '12px',
                borderRadius: '8px',
                background: needMore > 0 ? 'rgba(100, 116, 139, 0.5)' : 'rgba(16, 185, 129, 0.8)',
                border: 'none',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: needMore > 0 ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? '⏳ Training...'
                : needMore > 0
                  ? `Need ${needMore} more tagged networks`
                  : '🚀 Train Model Now'}
            </button>

            <button
              onClick={reassessNetworks}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(71, 85, 105, 0.6)',
                border: 'none',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '🔄 Reassessing...' : '🔄 Reassess All Networks'}
            </button>

            {result && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '8px',
                  background:
                    result.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  border:
                    result.type === 'success'
                      ? '1px solid rgba(34, 197, 94, 0.4)'
                      : '1px solid rgba(239, 68, 68, 0.4)',
                  color: result.type === 'success' ? '#4ade80' : '#f87171',
                }}
              >
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {result.message}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
