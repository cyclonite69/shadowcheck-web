import React from 'react';

export interface KeplerHeaderControlsProps {
  showMenu: boolean;
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
}

export const KeplerHeaderControls: React.FC<KeplerHeaderControlsProps> = ({
  showMenu,
  setShowMenu,
  showFilters,
  setShowFilters,
}) => {
  return (
    <>
      <button
        aria-label={showMenu ? 'Close layers' : 'Open layers'}
        onClick={() => setShowMenu(!showMenu)}
        title="Layers"
        style={{
          height: '24px',
          width: '28px',
          borderRadius: '5px',
          border: showMenu
            ? '0.5px solid rgba(59,130,246,0.4)'
            : '0.5px solid rgba(255,255,255,0.10)',
          background: showMenu ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
          color: showMenu ? '#60a5fa' : 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
          <path
            d="M8 1l7 3.5-7 3.5L1 4.5 8 1zm0 5.5l7 3.5-7 3.5-7-3.5 7-3.5zm0 5l7 3.5-7 3.5-7-3.5 7-3.5z"
            opacity=".85"
          />
        </svg>
      </button>
      <button
        aria-label="Toggle filters"
        onClick={() => setShowFilters(!showFilters)}
        title="Toggle filters"
        style={
          showFilters
            ? {
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid rgba(59,130,246,0.4)',
                background: 'rgba(59,130,246,0.16)',
                color: '#93c5fd',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(59,130,246,0.08)',
              }
            : {
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="1" width="14" height="1.2" rx="0.6" fill="currentColor" opacity="0.9" />
          <rect x="1" y="4" width="12" height="1.2" rx="0.6" fill="currentColor" opacity="0.8" />
          <rect x="2" y="7" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.7" />
          <rect x="3" y="10" width="8" height="1.2" rx="0.6" fill="currentColor" opacity="0.6" />
          <rect x="4" y="12" width="6" height="1.2" rx="0.6" fill="currentColor" opacity="0.5" />
        </svg>
      </button>
    </>
  );
};
