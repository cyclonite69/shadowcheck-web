import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Navigation: React.FC = () => {
  const [navVisible, setNavVisible] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const { isAdmin, logout } = useAuth();
  const demoMode = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < 960);
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = useMemo(
    () =>
      [
        demoMode ? { href: '/', label: 'Start' } : null,
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/geospatial-explorer', label: 'Geospatial' },
        { href: '/analytics', label: 'Analytics' },
        { href: '/monitoring', label: 'Monitoring' },
        { href: '/wigle', label: 'WiGLE' },
        { href: '/kepler', label: 'Kepler' },
        isAdmin ? { href: '/admin', label: 'Admin' } : null,
      ].filter(Boolean) as Array<{ href: string; label: string }>,
    [demoMode, isAdmin]
  );

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
      setMobileNavOpen(false);
    }
  };

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="fixed top-4 right-4 z-[10001] rounded-xl border border-slate-600/60 bg-slate-950/90 px-3 py-2 text-slate-200 shadow-2xl backdrop-blur-xl"
        >
          Menu
        </button>
        {mobileNavOpen && (
          <>
            <div
              className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-[10001] w-[min(84vw,22rem)] border-r border-slate-700/60 bg-slate-950/95 px-4 py-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-blue-300">ShadowCheck</div>
                  <div className="text-xs text-slate-400">Navigation</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300"
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`block rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      isActive(link.href)
                        ? 'border border-blue-500/50 bg-blue-500/20 text-blue-200'
                        : 'border border-slate-700/60 bg-slate-900/70 text-slate-200'
                    }`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-6 w-full rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200"
              >
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </>
        )}
      </>
    );
  }

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
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={linkStyle(link.href)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {link.label}
          </a>
        ))}
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
