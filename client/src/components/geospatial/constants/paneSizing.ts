/**
 * Shared layout constants for the geospatial explorer split-pane.
 *
 * Imported by both useMapDimensions and useGeospatialExplorerState to avoid
 * circular dependencies. Do not import from either hook here.
 */

/** Height of the map panel header bar (px). */
export const MAP_HEADER_HEIGHT = 48;

/**
 * Minimum map height during free-drag. Keeps a small sliver of map visible
 * at the bottom of a drag so the user never accidentally hides it entirely.
 */
export const MIN_TABLE_HEIGHT = 150;

/**
 * Space that must be reserved at the bottom of the flex column to keep the
 * resize handle on screen when the map pane is maximised (▼ snap).
 *
 *   ResizeHandle  18 px  (handle div height)
 *   gap-1          4 px  (Tailwind gap between map section and table card)
 *   ─────────────────────
 *   Total         22 px
 *
 * With mapHeight = containerHeight − SNAP_BUFFER:
 *   table card height = 0 px  (fully collapsed beneath the handle)
 *   handle bottom y   = containerHeight − 4 px  (≈ flush with viewport bottom)
 */
export const SNAP_BUFFER = 22;
