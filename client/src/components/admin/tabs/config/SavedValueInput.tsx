import React from 'react';

interface SavedValueInputProps {
  actualValue: string;
  savedValue: string;
  onChange: (value: string) => void;
  sensitive?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: string;
  min?: string;
  placeholder?: string;
  className: string;
}

const maskSavedValue = (value: string, sensitive: boolean) => {
  if (!value) return '';
  if (!sensitive) return value;
  return `${value.slice(0, 6)}...`;
};

export const SavedValueInput: React.FC<SavedValueInputProps> = ({
  actualValue,
  savedValue,
  onChange,
  sensitive = false,
  inputMode,
  step,
  min,
  placeholder,
  className,
}) => {
  const [focused, setFocused] = React.useState(false);
  const isDirty = actualValue !== savedValue;
  const isEditing = focused || isDirty;
  const hasSavedValue = savedValue.length > 0;
  const displayValue =
    isEditing || !hasSavedValue ? actualValue : maskSavedValue(savedValue, sensitive);

  return (
    <input
      type="text"
      inputMode={inputMode}
      step={step}
      min={min}
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={!hasSavedValue ? placeholder : undefined}
      className={`${className} ${!isEditing && hasSavedValue ? 'text-slate-400' : 'text-white'}`}
    />
  );
};
