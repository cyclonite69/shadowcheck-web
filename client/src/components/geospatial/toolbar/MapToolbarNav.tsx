import React from 'react';

interface MapToolbarNavProps {
  navOpen: boolean;
  setNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navRef: React.RefObject<HTMLDivElement | null>;
  onGps: () => void;
  onResetBearing?: () => void;
  onResetPitch?: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const MapToolbarNav = ({
  navOpen,
  setNavOpen,
  navRef,
  onGps,
  onResetBearing,
  onResetPitch,
}: MapToolbarNavProps) => {
  return (
    <div ref={navRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setNavOpen((v) => !v)}
        title="Navigation menu"
        style={{
          width: '30px',
          height: '28px',
          borderRadius: '6px',
          border: navOpen
            ? '0.5px solid rgba(59,130,246,0.3)'
            : '0.5px solid rgba(255,255,255,0.10)',
          background: navOpen ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.03)',
          color: navOpen ? '#60a5fa' : 'rgba(255,255,255,0.5)',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {navOpen ? '✕' : '≡'}
      </button>
      {navOpen && (
        <nav
          style={{
            position: 'fixed',
            left: 0,
            top: '48px',
            width: '220px',
            height: 'calc(100vh - 48px)',
            background: '#0e1117',
            borderRight: '0.5px solid rgba(59,130,246,0.12)',
            padding: '8px 0',
            zIndex: 999,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '6px 14px 4px',
              ...mono,
              fontSize: '10px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Pages
          </div>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/geospatial-explorer', label: 'Geospatial Explorer' },
            { href: '/analytics', label: 'Analytics' },
            { href: '/wigle', label: 'WiGLE' },
            { href: '/kepler', label: 'Kepler' },
            { href: '/monitoring', label: 'Monitoring' },
            { href: '/endpoint-test', label: 'API Test' },
            { href: '/admin', label: 'Admin' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '8px 14px',
                ...mono,
                fontSize: '12px',
                color: window.location.pathname === item.href ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
                borderRadius: '4px',
                margin: '0 6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color =
                  window.location.pathname === item.href ? '#60a5fa' : 'rgba(255,255,255,0.5)';
              }}
            >
              {item.label}
            </a>
          ))}
          <div
            style={{
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
              margin: '8px 14px',
            }}
          />
          <div
            style={{
              padding: '6px 14px 4px',
              ...mono,
              fontSize: '10px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Map tools
          </div>
          <div
            onClick={() => {
              onGps();
              setNavOpen(false);
            }}
            style={{
              padding: '8px 14px',
              ...mono,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              borderRadius: '4px',
              margin: '0 6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            Go to GPS
          </div>
          {onResetBearing && (
            <div
              onClick={() => {
                onResetBearing();
                setNavOpen(false);
              }}
              style={{
                padding: '8px 14px',
                ...mono,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                borderRadius: '4px',
                margin: '0 6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              Reset bearing
            </div>
          )}
          {onResetPitch && (
            <div
              onClick={() => {
                onResetPitch();
                setNavOpen(false);
              }}
              style={{
                padding: '8px 14px',
                ...mono,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                borderRadius: '4px',
                margin: '0 6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              Reset pitch
            </div>
          )}
        </nav>
      )}
    </div>
  );
};
