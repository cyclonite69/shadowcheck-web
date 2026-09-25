/** Dev-only sibling topology traces (set VITE_SIBLING_TOPOLOGY_DEBUG=false to disable). */
export const SIBLING_TOPOLOGY_DEBUG_ENABLED =
  import.meta.env.DEV &&
  String(import.meta.env.VITE_SIBLING_TOPOLOGY_DEBUG ?? 'false').toLowerCase() === 'true';

export function logSiblingTopology(stage: string, payload: Record<string, unknown>): void {
  if (!SIBLING_TOPOLOGY_DEBUG_ENABLED) {
    return;
  }
  console.debug(`[DEBUG] [sibling-topology] ${stage}`, payload);
}

export function componentSizesFromGroupMap(groupMap: Map<string, string>): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const gid of groupMap.values()) {
    sizes[gid] = (sizes[gid] ?? 0) + 1;
  }
  return sizes;
}
