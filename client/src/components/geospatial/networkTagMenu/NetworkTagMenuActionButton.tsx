import React, { useEffect, useState } from 'react';

interface NetworkTagMenuActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  textColor?: string;
  background?: string;
  activeBackground?: string;
  hoverBackground?: string;
  cursor?: string;
  title?: string;
  style?: React.CSSProperties;
  titleHint?: string;
}

export const NetworkTagMenuActionButton = ({
  label,
  onClick,
  disabled,
  textColor = '#e2e8f0',
  background,
  activeBackground,
  hoverBackground,
  cursor = 'pointer',
  title,
  style,
}: NetworkTagMenuActionButtonProps) => {
  const [currentBg, setCurrentBg] = useState<string>(
    activeBackground ?? background ?? 'transparent'
  );

  useEffect(() => {
    setCurrentBg(activeBackground ?? background ?? 'transparent');
  }, [activeBackground, background]);

  const handleMouseEnter = () => {
    if (disabled) return;
    setCurrentBg(hoverBackground ?? activeBackground ?? background ?? 'transparent');
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setCurrentBg(activeBackground ?? background ?? 'transparent');
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        background: currentBg,
        border: 'none',
        color: textColor,
        textAlign: 'left',
        cursor: disabled ? 'wait' : cursor,
        fontSize: '12px',
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {label}
    </button>
  );
};
