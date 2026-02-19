import React, { useState, useEffect, useMemo } from 'react';
import { useNetworkObservations } from '../../hooks/useNetworkObservations';
import { createPortal } from 'react-dom';

interface NetworkTimeFrequencyModalProps {
  bssid: string;
  ssid: string;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const NetworkTimeFrequencyModal: React.FC<NetworkTimeFrequencyModalProps> = ({
  bssid,
  ssid,
  onClose,
}) => {
  const { observations, loading, error } = useNetworkObservations(bssid);
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
    count: number;
    avgSignal: number;
  } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Set up portal container on mount, prevent background scroll
  useEffect(() => {
    let container = document.getElementById('modal-root');
    let created = false;
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-root';
      document.body.appendChild(container);
      created = true;
    }
    setPortalContainer(container);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      if (created && container?.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

  // Build heatmap grid (day-of-week × hour-of-day)
  const { grid, maxCount, totalObs, dateRange, confidence } = useMemo(() => {
    // Initialize grid: [day][hour] = { count, totalSignal }
    const g: { count: number; totalSignal: number }[][] = Array(7)
      .fill(null)
      .map(() =>
        Array(24)
          .fill(null)
          .map(() => ({ count: 0, totalSignal: 0 }))
      );

    let maxC = 0;
    let minTime = Infinity;
    let maxTime = -Infinity;

    observations.forEach((obs) => {
      const date = new Date(obs.time);
      const day = date.getDay(); // 0-6 (Sun-Sat)
      const hour = date.getHours(); // 0-23

      // Extra safety check for valid indices
      if (isNaN(day) || isNaN(hour) || day < 0 || day > 6 || hour < 0 || hour > 23) {
        return;
      }

      g[day][hour].count++;
      g[day][hour].totalSignal += obs.signal;

      if (g[day][hour].count > maxC) {
        maxC = g[day][hour].count;
      }

      if (obs.time < minTime) minTime = obs.time;
      if (obs.time > maxTime) maxTime = obs.time;
    });

    const range =
      minTime !== Infinity
        ? {
            start: new Date(minTime).toLocaleDateString(),
            end: new Date(maxTime).toLocaleDateString(),
          }
        : null;

    // Confidence heuristic: Sparse data makes temporal patterns less reliable
    const conf =
      observations.length === 0
        ? 'No data'
        : observations.length < 20
          ? 'Low (Sparse data)'
          : observations.length < 100
            ? 'Medium'
            : 'High';

    return {
      grid: g,
      maxCount: maxC,
      totalObs: observations.length,
      dateRange: range,
      confidence: conf,
    };
  }, [observations]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const cellSize = 32;
  const getIntensityColor = (count: number) => {
    if (count === 0) return 'rgb(30, 41, 59)'; // slate-800
    const intensity = Math.min(1, count / Math.max(maxCount, 1));
    // Gradient from slate-700 (low) to emerald-500 (high)
    if (intensity < 0.25) return `rgba(52, 211, 153, ${0.2 + intensity * 1.5})`;
    if (intensity < 0.5) return `rgba(52, 211, 153, ${0.4 + intensity})`;
    if (intensity < 0.75) return `rgba(16, 185, 129, ${0.6 + intensity * 0.4})`;
    return `rgba(5, 150, 105, ${0.8 + intensity * 0.2})`;
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-freq-modal-title"
    >
      <div className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col min-h-0 overflow-hidden text-white shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-blue-400 text-xl" aria-hidden="true">
                📅
              </span>
              <h2 id="time-freq-modal-title" className="text-xl font-bold">
                Temporal Activity Pattern
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              {ssid || '(Hidden SSID)'} • {bssid}
              {dateRange && (
                <span className="ml-2 text-slate-500">
                  • {dateRange.start} → {dateRange.end}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            title="Close"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl bg-transparent border-none cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-1 min-h-0 gap-6">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-slate-400">Loading observations...</div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-red-400 bg-red-900/30 px-4 py-3 rounded-lg">{error}</div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Legend & Stats */}
              <div className="bg-slate-800 rounded-lg p-4 shrink-0">
                <div className="flex gap-6 text-sm flex-wrap justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ background: 'rgb(30, 41, 59)' }}
                        aria-hidden="true"
                      ></div>
                      <span className="text-slate-400">No sightings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ background: 'rgba(52, 211, 153, 0.4)' }}
                        aria-hidden="true"
                      ></div>
                      <span className="text-slate-400">Low activity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ background: 'rgba(5, 150, 105, 0.9)' }}
                        aria-hidden="true"
                      ></div>
                      <span className="text-slate-400">High activity</span>
                    </div>
                  </div>
                  <div className="text-slate-300 flex gap-4">
                    <div>
                      Pattern Confidence:{' '}
                      <span
                        className={`font-bold ${confidence.includes('Low') ? 'text-amber-400' : 'text-emerald-400'}`}
                      >
                        {confidence}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold">
                        {totalObs.toLocaleString()}
                      </span>{' '}
                      total observations
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="bg-slate-800 rounded-lg p-6 flex-1 min-h-0 overflow-auto">
                {totalObs === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    No observations found for this network
                  </div>
                ) : (
                  <div className="flex gap-4 items-start">
                    {/* Y-axis (Days) */}
                    <div
                      className="flex flex-col justify-around shrink-0 pt-8"
                      style={{ height: 7 * cellSize }}
                      aria-hidden="true"
                    >
                      {DAYS.map((day) => (
                        <div key={day} className="text-xs text-slate-400 h-8 flex items-center">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Grid SVG */}
                    <div className="shrink-0">
                      <div
                        className="flex justify-between mb-2 text-xs text-slate-400 px-1"
                        style={{ width: 24 * cellSize }}
                        aria-hidden="true"
                      >
                        {HOURS.filter((h) => h % 3 === 0).map((h) => (
                          <span key={h} style={{ width: cellSize * 3, textAlign: 'left' }}>
                            {h.toString().padStart(2, '0')}:00
                          </span>
                        ))}
                      </div>
                      <svg
                        width={24 * cellSize}
                        height={7 * cellSize}
                        role="img"
                        aria-label="Heatmap showing observation frequency by day of week and hour of day"
                      >
                        {grid.map((dayData, dayIdx) =>
                          dayData.map((cell, hourIdx) => {
                            const isHovered =
                              hoveredCell?.day === dayIdx && hoveredCell?.hour === hourIdx;
                            return (
                              <g key={`${dayIdx}-${hourIdx}`}>
                                <rect
                                  x={hourIdx * cellSize}
                                  y={dayIdx * cellSize}
                                  width={cellSize - 2}
                                  height={cellSize - 2}
                                  rx={4}
                                  fill={getIntensityColor(cell.count)}
                                  className="cursor-pointer transition-all"
                                  stroke={isHovered ? '#fff' : 'transparent'}
                                  strokeWidth={isHovered ? 2 : 0}
                                  onMouseEnter={() =>
                                    setHoveredCell({
                                      day: dayIdx,
                                      hour: hourIdx,
                                      count: cell.count,
                                      avgSignal: cell.count > 0 ? cell.totalSignal / cell.count : 0,
                                    })
                                  }
                                  onMouseLeave={() => setHoveredCell(null)}
                                />
                                {cell.count > 0 && cellSize >= 24 && (
                                  <text
                                    x={hourIdx * cellSize + cellSize / 2 - 1}
                                    y={dayIdx * cellSize + cellSize / 2 + 4}
                                    textAnchor="middle"
                                    className="text-[10px] fill-white font-medium pointer-events-none"
                                    style={{ opacity: cell.count / maxCount > 0.3 ? 1 : 0.7 }}
                                  >
                                    {cell.count}
                                  </text>
                                )}
                              </g>
                            );
                          })
                        )}
                      </svg>
                      <div
                        className="flex justify-center mt-3 text-xs text-slate-500"
                        aria-hidden="true"
                      >
                        Hour of Day →
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Hover info */}
              {hoveredCell && hoveredCell.count > 0 && (
                <div className="bg-slate-800 rounded-lg p-4 text-sm shrink-0" aria-live="polite">
                  <div className="font-semibold text-white mb-2">Time Slot Details:</div>
                  <div className="text-slate-300 grid grid-cols-4 gap-4">
                    <div>
                      <span className="text-slate-400">Day:</span>{' '}
                      <span className="text-emerald-400 font-medium">{DAYS[hoveredCell.day]}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Hour:</span>{' '}
                      <span className="text-emerald-400 font-medium">
                        {hoveredCell.hour.toString().padStart(2, '0')}:00 -{' '}
                        {((hoveredCell.hour + 1) % 24).toString().padStart(2, '0')}:00
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sightings:</span>{' '}
                      <span className="text-emerald-400 font-bold">{hoveredCell.count}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg Signal:</span>{' '}
                      <span className="text-amber-400 font-medium">
                        {hoveredCell.avgSignal.toFixed(0)} dBm
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Summary */}
              {totalObs > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 text-sm shrink-0 border border-slate-700/50">
                  <div className="font-semibold text-white mb-3">Activity Summary</div>
                  <div className="grid grid-cols-2 gap-4 text-slate-300">
                    <div>
                      <div className="text-slate-400 text-xs mb-1">Most Active Days</div>
                      {(() => {
                        const dayTotals = DAYS.map((day, i) => ({
                          day,
                          count: grid[i].reduce((sum, cell) => sum + cell.count, 0),
                        })).sort((a, b) => b.count - a.count);
                        return dayTotals
                          .slice(0, 3)
                          .filter((d) => d.count > 0)
                          .map((d) => (
                            <span key={d.day} className="mr-2 text-emerald-400">
                              {d.day}: {d.count}
                            </span>
                          ));
                      })()}
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs mb-1">Peak Hours</div>
                      {(() => {
                        const hourTotals = HOURS.map((h) => ({
                          hour: h,
                          count: grid.reduce((sum, dayRow) => sum + dayRow[h].count, 0),
                        })).sort((a, b) => b.count - a.count);
                        return hourTotals
                          .slice(0, 3)
                          .filter((h) => h.count > 0)
                          .map((h) => (
                            <span key={h.hour} className="mr-2 text-amber-400">
                              {h.hour.toString().padStart(2, '0')}:00: {h.count}
                            </span>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Wait for portal container before rendering
  if (!portalContainer) {
    return null;
  }

  return createPortal(modalContent, portalContainer);
};

export default NetworkTimeFrequencyModal;
