import React, { useRef, useState } from 'react';
import { BrandIcon } from './geospatial/toolbar/MapToolbarIcons';
import { MapToolbarNav } from './geospatial/toolbar/MapToolbarNav';

interface AppHeaderProps {
  pageLabel: string;
  rightContent?: React.ReactNode;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const AppHeader: React.FC<AppHeaderProps> = ({ pageLabel, rightContent }) => {
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '48px',
        padding: '0 14px',
        gap: '8px',
        background: 'var(--nav-bg)',
        borderBottom: '0.5px solid var(--nav-border)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 100,
        boxSizing: 'border-box',
      }}
    >
      {/* Burger — far left, opens the same nav sidebar as geospatial */}
      <MapToolbarNav navOpen={navOpen} setNavOpen={setNavOpen} navRef={navRef} />

      {/* Brand icon */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '5px',
          background: 'rgba(59,130,246,0.12)',
          border: '0.5px solid rgba(59,130,246,0.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <BrandIcon />
      </div>

      {/* ShadowCheck + page label */}
      <span
        style={{
          ...mono,
          fontSize: '14px',
          fontWeight: 500,
          color: '#e2e8f0',
          whiteSpace: 'nowrap',
        }}
      >
        Shadow<span style={{ color: '#60a5fa' }}>Check</span>{' '}
        <span style={{ color: '#60a5fa' }}>{pageLabel}</span>
      </span>

      {/* Right slot */}
      {rightContent && (
        <>
          <div style={{ marginLeft: 'auto' }} />
          {rightContent}
        </>
      )}
    </div>
  );
};
