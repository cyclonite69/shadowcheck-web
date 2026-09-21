export {};

const logger = require('../../logging/logger');

type AdminQuery = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

type MaterializedViewFailure = {
  view: string;
  error: string;
  critical: boolean;
};

const CRITICAL_VIEWS = new Set(['app.api_network_explorer_mv']);
const MATERIALIZED_VIEWS = [
  { name: 'app.api_network_explorer_mv', concurrent: true },
  { name: 'app.analytics_summary_mv', concurrent: false },
  { name: 'app.mv_sibling_groups', concurrent: true },
  { name: 'app.surveillance_density_zones', concurrent: true },
];

const loadExistingViews = async (runAdminQuery: AdminQuery): Promise<Set<string>> => {
  const existingViewsResult = await runAdminQuery(
    `
      SELECT schemaname || '.' || matviewname AS full_name
      FROM pg_matviews
      WHERE schemaname = 'app'
    `
  );

  return new Set(existingViewsResult.rows.map((row: { full_name: string }) => row.full_name));
};

const throwOnRefreshFailures = (failures: MaterializedViewFailure[]) => {
  if (failures.length === 0) {
    return;
  }

  const hasCritical = failures.some((failure) => failure.critical);
  const summary = failures.map((failure) => `${failure.view}: ${failure.error}`).join('; ');
  const err = new Error(summary) as Error & { severity?: string };
  if (hasCritical) {
    err.severity = 'CRITICAL_FAILURE';
  }
  throw err;
};

const refreshMaterializedViews = async (
  runAdminQuery: AdminQuery
): Promise<{ refreshedViews: string[] }> => {
  logger.info('[MV Refresh Job] Starting materialized view refresh...');

  // Refresh network_locations FIRST — the MV (api_network_explorer_mv) now includes
  // centroid_lat/lon and weighted_lat/lon from this table. Computing centroids before
  // the MV refresh ensures the MV snapshot contains fresh centroid data.
  try {
    logger.info('[MV Refresh Job] Refreshing app.network_locations (pre-MV dependency)...');
    await runAdminQuery('SELECT app.refresh_network_locations()');
    logger.info('[MV Refresh Job] app.network_locations refreshed.');
  } catch (error) {
    // Non-critical: the MV will still work with stale centroid values (or NULLs).
    logger.error('[MV Refresh Job] Failed to refresh network_locations:', (error as Error).message);
  }

  const existingViews = await loadExistingViews(runAdminQuery);
  const availableViews = MATERIALIZED_VIEWS.filter((view) => existingViews.has(view.name));
  const missingViews = MATERIALIZED_VIEWS.filter((view) => !existingViews.has(view.name)).map(
    (view) => view.name
  );

  const failures: MaterializedViewFailure[] = [];

  if (missingViews.length > 0) {
    logger.warn(
      `[MV Refresh Job] Skipping non-existent materialized views: ${missingViews.join(', ')}`
    );
  }

  for (const view of availableViews) {
    try {
      const sql = `REFRESH MATERIALIZED VIEW ${view.concurrent ? 'CONCURRENTLY ' : ''}${view.name}`;
      logger.info(`[MV Refresh Job] Refreshing ${view.name}...`);
      await runAdminQuery(sql);
    } catch (error) {
      const isCritical = CRITICAL_VIEWS.has(view.name);
      failures.push({
        view: view.name,
        error: (error as Error).message,
        critical: isCritical,
      });
      logger.error(
        `[MV Refresh Job] ${isCritical ? 'CRITICAL ' : ''}Failed to refresh ${view.name}: ${(error as Error).message}`
      );
    }
  }

  throwOnRefreshFailures(failures);

  return { refreshedViews: MATERIALIZED_VIEWS.map((view) => view.name) };
};

export { refreshMaterializedViews };
