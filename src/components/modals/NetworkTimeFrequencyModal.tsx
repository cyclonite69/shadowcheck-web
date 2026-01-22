import React, { useState } from 'react';

const NetworkTimeFrequencyModal = ({ bssid, ssid, onClose }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [viewMode, setViewMode] = useState('day');

  const generateGrid = () => {
    const timeSlots = 50;
    let channels = 40; // Default BLE

    // Simulate device type based on BSSID
    const deviceType = bssid.includes('a') ? 'WiFi-5GHz' : bssid.includes('b') ? 'WiFi-2.4GHz' : 'BLE';

    if (deviceType === 'WiFi-5GHz') channels = 200;
    else if (deviceType === 'WiFi-2.4GHz') channels = 14;

    const grid = Array(channels).fill(null).map(() => Array(timeSlots).fill(null));

    // Generate simulated data
    for (let i = 0; i < 100; i++) {
      const timeIdx = Math.floor(Math.random() * timeSlots);
      const chIdx = Math.floor(Math.random() * channels);
      const signalStrength = Math.random();

      grid[chIdx][timeIdx] = {
        type: deviceType.includes('WiFi') ? 'WIFI' : 'BLE',
        color: deviceType.includes('WiFi') ? '#3b82f6' : '#10b981',
        power: Math.max(0.3, Math.min(1, signalStrength)),
        signal: -30 - (Math.random() * 70),
        freq: deviceType === 'WiFi-5GHz' ? 5000 + Math.random() * 1000 : 2400 + Math.random() * 100
      };
    }

    return { grid, channels, timeSlots, deviceType };
  };

  const { grid, channels, timeSlots, deviceType } = generateGrid();
  const cellSize = 12;

  return (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 z-[50000] flex items-center justify-center p-4 bg-black/80"
      style={{ position: 'fixed', inset: 0, zIndex: 50000 }}
    >
      <div className="bg-slate-900 rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col min-h-0 overflow-hidden text-white shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-blue-400 text-xl">📡</span>
              <h2 className="text-xl font-bold">Time-Frequency Grid</h2>
            </div>
            <p className="text-sm text-slate-400">
              {ssid} • {bssid} • Type: {deviceType}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl bg-transparent border-none cursor-pointer p-1"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-1 min-h-0 gap-6 overflow-hidden">
          {/* Legend */}
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>WiFi</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>BLE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-700 border border-slate-600 rounded"></div>
                <span>Idle</span>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="bg-slate-800 rounded-lg p-6 flex-1 min-h-0 overflow-auto">
            <div className="flex gap-4 items-start">
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-right shrink-0" style={{ height: channels * cellSize }}>
                {[channels - 1, Math.floor(channels * 3 / 4), Math.floor(channels / 2), Math.floor(channels / 4), 0].map((ch) => (
                  <div key={ch} className="text-xs text-slate-400">
                    {deviceType === 'BLE' ? `Ch ${ch}` : `${2400 + ch * 5}MHz`}
                  </div>
                ))}
              </div>

              {/* Grid SVG */}
              <div className="shrink-0">
                <div className="mb-2 text-xs text-slate-400 text-center">Time →</div>
                <svg width={timeSlots * cellSize} height={channels * cellSize}>
                  {grid.map((row, chIdx) =>
                    row.map((cell, timeIdx) => {
                      const isHovered = hoveredCell?.ch === chIdx && hoveredCell?.time === timeIdx;
                      return (
                        <g key={`${chIdx}-${timeIdx}`}>
                          <rect
                            x={timeIdx * cellSize}
                            y={chIdx * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill={cell ? cell.color : '#1e293b'}
                            stroke="#0f172a"
                            strokeWidth="0.5"
                            opacity={cell ? cell.power : 0.3}
                            onMouseEnter={() => setHoveredCell({ ch: chIdx, time: timeIdx, data: cell })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className="cursor-pointer"
                          />
                          {isHovered && (
                            <rect
                              x={timeIdx * cellSize}
                              y={chIdx * cellSize}
                              width={cellSize}
                              height={cellSize}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      );
                    })
                  )}
                </svg>
                <div className="flex justify-between mt-2" style={{ width: timeSlots * cellSize }}>
                  <span className="text-xs text-slate-400">0</span>
                  <span className="text-xs text-slate-400">{Math.floor(timeSlots / 2)}</span>
                  <span className="text-xs text-slate-400">{timeSlots}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hover info */}
          {hoveredCell?.data && (
            <div className="mt-4 bg-slate-800 rounded-lg p-4 text-sm">
              <div className="font-semibold text-white mb-2">Cell Information:</div>
              <div className="text-slate-300 grid grid-cols-3 gap-4">
                <div><span className="text-slate-400">Channel:</span> {hoveredCell.ch}</div>
                <div><span className="text-slate-400">Time Slot:</span> {hoveredCell.time}</div>
                <div><span className="text-slate-400">Type:</span> {hoveredCell.data.type}</div>
                <div><span className="text-slate-400">Signal:</span> {hoveredCell.data.signal.toFixed(1)} dBm</div>
                <div><span className="text-slate-400">Frequency:</span> {hoveredCell.data.freq.toFixed(1)} MHz</div>
                <div><span className="text-slate-400">Power:</span> {(hoveredCell.data.power * 100).toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkTimeFrequencyModal;
