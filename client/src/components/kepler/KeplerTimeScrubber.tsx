import React, { useEffect, useRef, useState } from 'react';

export type KeplerWindowSize = number | 'all';

interface KeplerTimeScrubberProps {
  minTime: number;
  maxTime: number;
  currentTime: number;
  windowSize: KeplerWindowSize;
  onCurrentTimeChange: (time: number) => void;
  onWindowSizeChange: (size: KeplerWindowSize) => void;
}

const WINDOW_OPTIONS: Array<{ label: string; value: KeplerWindowSize }> = [
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '6 hours', value: 6 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
  { label: '7 days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: 'All Time', value: 'all' },
];

function formatUtc(time: number): string {
  return `${new Date(time).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

export const KeplerTimeScrubber: React.FC<KeplerTimeScrubberProps> = ({
  minTime,
  maxTime,
  currentTime,
  windowSize,
  onCurrentTimeChange,
  onWindowSizeChange,
}) => {
  const [playing, setPlaying] = useState(false);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  useEffect(() => {
    if (!playing || maxTime <= minTime) {
      return;
    }
    let frameId = 0;
    let previousFrameTime: number | null = null;
    const playbackRate = (maxTime - minTime) / 60000;

    const advance = (frameTime: number) => {
      if (previousFrameTime !== null) {
        const elapsed = frameTime - previousFrameTime;
        const nextTime = Math.min(maxTime, currentTimeRef.current + elapsed * playbackRate);
        currentTimeRef.current = nextTime;
        onCurrentTimeChange(nextTime);
        if (nextTime >= maxTime) {
          setPlaying(false);
          return;
        }
      }
      previousFrameTime = frameTime;
      frameId = window.requestAnimationFrame(advance);
    };

    frameId = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frameId);
  }, [maxTime, minTime, onCurrentTimeChange, playing]);

  const handlePlayToggle = () => {
    if (!playing && currentTime >= maxTime) {
      onCurrentTimeChange(minTime);
    }
    setPlaying((value) => !value);
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-30 w-[min(700px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-cyan-500/30 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlayToggle}
          disabled={minTime === maxTime}
          className="rounded-md border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={minTime}
          max={Math.max(maxTime, minTime + 1)}
          step="1"
          value={currentTime}
          onChange={(event) => onCurrentTimeChange(Number(event.target.value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-400"
          aria-label="Observation time"
          disabled={minTime === maxTime}
        />
        <select
          value={windowSize}
          onChange={(event) =>
            onWindowSizeChange(event.target.value === 'all' ? 'all' : Number(event.target.value))
          }
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          aria-label="Timeline window"
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex justify-between gap-3 font-mono text-[10px] text-slate-400">
        <span>{formatUtc(minTime)}</span>
        <span className="text-cyan-200">{formatUtc(currentTime)}</span>
        <span>{formatUtc(maxTime)}</span>
      </div>
    </div>
  );
};
