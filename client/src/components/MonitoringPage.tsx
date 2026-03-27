import { useEffect } from 'react';

const GRAFANA_EMBED_COOKIE =
  'shadowcheck_grafana_embed=1; Path=/; Max-Age=7200; Secure; SameSite=None';
const GRAFANA_DASHBOARD_PATH = '/grafana/d/shadowcheck-overview/shadowcheck-overview?orgId=1';
const GRAFANA_EMBED_SRC = `${GRAFANA_DASHBOARD_PATH}&kiosk`;

const MonitoringPage = () => {
  useEffect(() => {
    document.cookie = GRAFANA_EMBED_COOKIE;
  }, []);

  return (
    <section className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Monitoring</h1>
            <p className="mt-1 text-sm text-slate-400">
              Embedded Grafana served through the main HTTPS frontend.
            </p>
          </div>
          <a
            href={GRAFANA_DASHBOARD_PATH}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:text-blue-200"
          >
            Open Full Grafana
          </a>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-slate-900 p-4">
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
