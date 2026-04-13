import { useEffect } from 'react';
import { AppHeader } from './AppHeader';

const GRAFANA_DASHBOARD_PATH = '/grafana/d/shadowcheck-overview/shadowcheck-overview?orgId=1';
const GRAFANA_EMBED_SRC = `${GRAFANA_DASHBOARD_PATH}&kiosk`;

const MonitoringPage = () => {
  useEffect(() => {
    const secureCookie =
      window.location.protocol === 'https:' ? '; Secure; SameSite=None' : '; SameSite=Lax';
    document.cookie = `shadowcheck_grafana_embed=1; Path=/; Max-Age=7200${secureCookie}`;
  }, []);

  return (
    <section className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <AppHeader
        pageLabel="Monitoring"
        rightContent={
          <a
            href={GRAFANA_DASHBOARD_PATH}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: '5px',
              border: '0.5px solid rgba(255,255,255,0.10)',
              whiteSpace: 'nowrap',
            }}
          >
            Open Full Grafana ↗
          </a>
        }
      />

      <div className="min-h-0 flex-1 bg-slate-900 p-4 pt-[60px]">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
          <iframe
            title="ShadowCheck Monitoring"
            src={GRAFANA_EMBED_SRC}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </section>
  );
};

export default MonitoringPage;
