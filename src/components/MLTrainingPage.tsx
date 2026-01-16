import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logError } from '../logging/clientLogger';

// SVG Icons
const Brain = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const BarChart3 = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const Target = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const GripHorizontal = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </svg>
);

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

  const [cards, setCards] = useState([
    { id: 1, title: 'Model Training', icon: Brain, x: 0, y: 60, w: 50, h: 280, type: 'training' },
    { id: 2, title: 'Training Data', icon: BarChart3, x: 50, y: 60, w: 50, h: 280, type: 'data' },
    { id: 3, title: 'Model Status', icon: Target, x: 0, y: 350, w: 50, h: 280, type: 'status' },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });

  const handleMouseDown = useCallback(
    (e, cardId, action) => {
      e.preventDefault();
      if (action === 'move') {
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragging(cardId);
      } else if (action === 'resize') {
        const card = cards.find((c) => c.id === cardId);
        resizeStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startW: card.w,
          startH: card.h,
        };
        setResizing(cardId);
      }
    },
    [cards]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (dragging) {
        const container = e.currentTarget.getBoundingClientRect();
        const newX = ((e.clientX - container.left - dragOffset.x) / container.width) * 100;
        const newY = e.clientY - container.top - dragOffset.y;
        setCards((prev) =>
          prev.map((card) =>
            card.id === dragging
              ? { ...card, x: Math.max(0, Math.min(50, newX)), y: Math.max(60, newY) }
              : card
          )
        );
      } else if (resizing) {
        const deltaX = e.clientX - resizeStartRef.current.startX;
        const deltaY = e.clientY - resizeStartRef.current.startY;
        const container = e.currentTarget.getBoundingClientRect();
        const newW = resizeStartRef.current.startW + (deltaX / container.width) * 100;
        const newH = resizeStartRef.current.startH + deltaY;
        setCards((prev) =>
          prev.map((card) =>
            card.id === resizing
              ? { ...card, w: Math.max(25, Math.min(100, newW)), h: Math.max(200, newH) }
              : card
          )
        );
      }
    },
    [dragging, resizing, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/ml/status`);
      const data = await res.json();

      if (data.error) {
        logError('ML status error', data.error);
        setStatus({
          modelTrained: false,
          taggedNetworks: [],
          modelInfo: undefined,
        });
        return;
      }

      setStatus(data);
    } catch (err) {
      logError('Error loading status', err);
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
          message: `Model trained successfully! Accuracy: ${(data.model.accuracy * 100).toFixed(1)}%, F1: ${(data.model.f1 * 100).toFixed(1)}%`,
        });
        await loadStatus();
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Training failed',
        });
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: 'Network error during training',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCardContent = (card) => {
    const height = card.h - 60;

    switch (card.type) {
      case 'training':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">
              Train machine learning model for threat detection
            </div>

            <div className="mb-4">
              <button
                onClick={trainModel}
                disabled={loading}
                className="w-full p-3 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium"
              >
                {loading ? '🔄 Training Model...' : '🧠 Train Model'}
              </button>
            </div>

            {result && (
              <div
                className={`p-3 rounded mb-4 text-sm ${
                  result.type === 'success'
                    ? 'bg-green-900 text-green-200'
                    : 'bg-red-900 text-red-200'
                }`}
              >
                {result.message}
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-1">
              <p>• Requires at least 10 tagged networks</p>
              <p>• Uses logistic regression algorithm</p>
              <p>• Features: observation count, signal strength, location patterns</p>
              <p>• Training typically takes 5-30 seconds</p>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Tagged network data for training</div>

            {status?.taggedNetworks && status.taggedNetworks.length > 0 ? (
              <div className="space-y-2">
                {status.taggedNetworks.map((tag, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 bg-slate-800 rounded"
                  >
                    <span className="text-sm text-white capitalize">
                      {tag.tag_type.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-medium text-blue-400">{tag.count}</span>
                  </div>
                ))}
                <div className="mt-3 p-2 bg-slate-700 rounded">
                  <div className="text-xs text-slate-300">
                    Total: {status.taggedNetworks.reduce((sum, tag) => sum + tag.count, 0)} tagged
                    networks
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <p className="mb-2">No tagged networks found</p>
                <p className="text-xs">
                  Tag networks as threats or false positives to enable training
                </p>
              </div>
            )}
          </div>
        );

      case 'status':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Current model information</div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Model Status:</span>
                <span
                  className={`text-sm font-medium ${
                    status?.modelTrained ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {status?.modelTrained ? 'Trained' : 'Not Trained'}
                </span>
              </div>

              {status?.modelInfo?.updated_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Last Updated:</span>
                  <span className="text-sm text-slate-400">
                    {new Date(status.modelInfo.updated_at).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Algorithm:</span>
                <span className="text-sm text-slate-400">Logistic Regression</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">Features:</span>
                <span className="text-sm text-slate-400">7 behavioral</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
    >
      <div className="relative flex-1 overflow-y-auto" style={{ height: '100vh' }}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/60 shadow-2xl text-center">
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
              Machine Learning Training
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
              Train AI models for automated threat detection
            </p>
          </div>
        </div>

        {/* Cards */}
        <div style={{ minHeight: '1300px', position: 'relative' }}>
          {cards.map((card) => {
            const Icon = card.icon;
            const width = `${card.w}%`;
            const left = `${card.x}%`;

            return (
              <div
                key={card.id}
                style={{
                  position: 'absolute',
                  left: left,
                  top: `${card.y}px`,
                  width: width,
                  height: `${card.h}px`,
                }}
                className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-shadow group backdrop-blur-sm outline outline-1 outline-[#13223a]/60"
              >
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-[#132744]/95 border-b border-[#1c3050]">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                  </div>
                  <GripHorizontal
                    size={16}
                    className="text-white/50 group-hover:text-white transition-colors flex-shrink-0"
                  />
                </div>

                {/* Content */}
                <div className="overflow-hidden">{renderCardContent(card)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
