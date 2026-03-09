import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navigation: React.FC = () => {
  const [navVisible, setNavVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const { isAdmin, logout } = useAuth();
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  const isActive = (path: string) => location.pathname === path;

  const linkStyle = (path: string) => ({
    minWidth: '100px',
    padding: '10px 20px',
    color: isActive(path) ? '#93c5fd' : '#cbd5e1',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    borderRadius: '12px',
    background: isActive(path) ? 'rgba(59, 130, 246, 0.25)' : 'rgba(15, 23, 42, 0.4)',
    transition: 'all 0.2s ease',
    border: isActive(path)
      ? '1px solid rgba(59, 130, 246, 0.4)'
      : '1px solid rgba(71, 85, 105, 0.3)',
    textAlign: 'center' as const,
    boxShadow: isActive(path)
      ? '0 4px 16px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.1)'
      : '0 2px 8px rgba(0, 0, 0, 0.2)',
  });

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive(e.currentTarget.getAttribute('href') || '')) {
      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
      e.currentTarget.style.color = '#93c5fd';
      e.currentTarget.style.boxShadow =
        '0 4px 16px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.1)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href') || '';
    if (!isActive(href)) {
      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
      e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
      e.currentTarget.style.color = '#cbd5e1';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      e.currentTarget.style.transform = 'translateY(0)';
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setNavVisible(false);
    }
  };

  return (
    <>
      {/* Hover Area - Triggers nav to show - Very narrow and centered under Nav tab */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '3px',
          zIndex: 9999,
          pointerEvents: navVisible ? 'none' : 'auto',
        }}
        onMouseEnter={() => setNavVisible(true)}
      />

      {/* Floating Navigation Links */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: `translate(-50%, ${navVisible ? '0' : '-200%'})`,
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          opacity: navVisible ? 1 : 0,
          zIndex: 10000,
          display: 'flex',
          gap: '8px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(0, 0, 0, 0.5) 100%)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '1px solid rgba(100, 116, 139, 0.25)',
          boxShadow: navVisible
            ? '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 1px 0 rgba(255, 255, 255, 0.05) inset'
            : 'none',
        }}
        onMouseLeave={() => setNavVisible(false)}
      >
        {demoMode && (
          <a
            href="/"
            style={linkStyle('/')}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            Start
          </a>
        )}
        <a
          href="/dashboard"
          style={linkStyle('/dashboard')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Dashboard
        </a>
        <a
          href="/geospatial-explorer"
          style={linkStyle('/geospatial-explorer')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Geospatial
        </a>
        <a
          href="/analytics"
          style={linkStyle('/analytics')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Analytics
        </a>
        <a
          href="/wigle"
          style={linkStyle('/wigle')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          WiGLE
        </a>
        <a
          href="/kepler"
          style={linkStyle('/kepler')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Kepler
        </a>
        {isAdmin && (
          <a
            href="/admin"
            style={linkStyle('/admin')}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            Admin
          </a>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            minWidth: '100px',
            padding: '10px 20px',
            color: '#fecaca',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '0.3px',
            borderRadius: '12px',
            background: 'rgba(127, 29, 29, 0.35)',
            transition: 'all 0.2s ease',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            opacity: loggingOut ? 0.7 : 1,
          }}
          aria-label="Log out"
        >
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>

      {/* Pull-down indicator when nav is hidden */}
      {!navVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            padding: '6px 16px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0 0 10px 10px',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            borderTop: 'none',
            color: '#f1f5f9',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            setNavVisible(true);
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.98)';
          }}
        >
          ▼ Nav
        </div>
      )}
    </>
  );
};

export default Navigation;
