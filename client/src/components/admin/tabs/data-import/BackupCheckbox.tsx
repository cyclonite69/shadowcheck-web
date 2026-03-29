import React from 'react';

interface BackupCheckboxProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  label?: string;
  accentColor?: string;
}

export const BackupCheckbox: React.FC<BackupCheckboxProps> = ({
  enabled,
  onToggle,
  disabled = false,
  label = 'Back up database before importing',
  accentColor = 'accent-orange-500',
}) => (
  <label
    className={`flex items-center gap-2 select-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
  >
    <input
      type="checkbox"
      checked={enabled}
      onChange={(e) => onToggle(e.target.checked)}
      disabled={disabled}
      className={`w-4 h-4 rounded ${accentColor}`}
    />
    <span className="text-xs text-slate-400">{label}</span>
  </label>
);
