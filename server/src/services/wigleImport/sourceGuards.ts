export const ALLOWED_WIFI_SEARCH_SOURCES = ['wigle', 'wigle_v2'] as const;
export type AllowedWifiSearchSource = (typeof ALLOWED_WIFI_SEARCH_SOURCES)[number];

export function isWifiSearchSource(source: unknown): source is AllowedWifiSearchSource {
  return (
    typeof source === 'string' &&
    (ALLOWED_WIFI_SEARCH_SOURCES as readonly string[]).includes(source)
  );
}

/**
 * Asserts that the import run source is an allowlisted Wi-Fi search source ('wigle' or 'wigle_v2').
 * Throws an Error with status 400 if the source is missing, null, empty, or non-Wi-Fi.
 */
export function assertWifiSearchSource<T extends { id?: number | string; source?: string | null }>(
  run: T,
  context: 'service' | 'orchestrator' = 'service'
): asserts run is T & { source: AllowedWifiSearchSource } {
  if (run.source === 'wigle_bt' && context === 'service') {
    const error: any = new Error('Cannot resume Bluetooth import run via WiFi search service');
    error.status = 400;
    throw error;
  }

  if (!run.source || !(ALLOWED_WIFI_SEARCH_SOURCES as readonly string[]).includes(run.source)) {
    const action = context === 'orchestrator' ? 'execute' : 'resume';
    const target = context === 'orchestrator' ? 'WiFi search orchestrator' : 'WiFi search service';
    const sourceLabel = run.source && run.source !== '' ? run.source : 'unknown';
    const error: any = new Error(
      `Cannot ${action} non-WiFi search import run #${run.id} (source: '${sourceLabel}') via ${target}`
    );
    error.status = 400;
    throw error;
  }
}
