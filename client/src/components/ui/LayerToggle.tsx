import React from 'react';

interface LayerToggleProps {
  label: string;
  enabled: boolean;
  onChange: () => void;
  color?: string;
}

export const LayerToggle: React.FC<LayerToggleProps> = ({
  label,
  enabled,
  onChange,
  color = '#38bdf8',
}) => {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 w-full py-1 px-0.5 rounded hover:bg-slate-800/50 transition-colors group"
    >
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: enabled ? color : '#475569' }}
      />

      {/* Label */}
      <span
        className={`text-xs flex-1 text-left transition-colors ${
          enabled ? 'text-slate-200' : 'text-slate-500'
        }`}
      >
        {label}
      </span>

      {/* Mini toggle switch */}
      <span
        className={`relative inline-flex h-[18px] w-[32px] shrink-0 rounded-full border transition-colors ${
          enabled ? 'bg-sky-600 border-sky-500' : 'bg-slate-700 border-slate-600'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-[15px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  );
};
