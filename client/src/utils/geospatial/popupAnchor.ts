import type { LngLatLike, Map } from 'mapbox-gl';

type PopupAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Measure the tooltip's natural rendered size.
// Must NOT append inside the map container — Mapbox sets overflow:hidden on it,
// which clips absolutely-positioned children and causes getBoundingClientRect()
// to return the container's clamped height instead of the tooltip's true height.
// Fixed positioning on document.body is unclipped and gives accurate dimensions.
function measurePopupSize(html: string): { width: number; height: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;left:-9999px;top:0;z-index:-1;';
  probe.innerHTML = html;
  document.body.appendChild(probe);
  const measured = (probe.firstElementChild as HTMLElement | null) ?? probe;
  const { width, height } = measured.getBoundingClientRect();
  document.body.removeChild(probe);
  return { width: width || 288, height: height || 320 };
}

export function getPopupAnchor(map: Map, lngLat: LngLatLike, html: string): PopupAnchor {
  const container = map.getContainer();
  const { width: tooltipWidth, height: tooltipHeight } = measurePopupSize(html);
  const point = map.project(lngLat);
  const bounds = container.getBoundingClientRect();
  const gap = 15; // px between marker and popup tip
  const margin = 20; // minimum breathing room from map edge

  // point.x / point.y are in map-container pixel coordinates (origin = container top-left).
  // bounds.width / bounds.height are the map container's rendered CSS dimensions —
  // use these directly so the bottom panel that overlays the viewport is already excluded.
  const overflowRight = point.x + gap + tooltipWidth > bounds.width - margin;
  const overflowBottom = point.y + gap + tooltipHeight > bounds.height - margin;
  // Prevent flipping upward into a marker that's also near the top edge.
  const overflowTop = point.y - gap - tooltipHeight < margin;

  // Anchor = which corner of the popup body sits closest to the marker coordinate.
  // 'top-left'    → popup extends DOWN + RIGHT from marker  (default, bottom-right quadrant safe)
  // 'top-right'   → popup extends DOWN + LEFT
  // 'bottom-left' → popup extends UP   + RIGHT
  // 'bottom-right'→ popup extends UP   + LEFT
  if (overflowRight && overflowBottom) return overflowTop ? 'top-right' : 'bottom-right';
  if (overflowRight) return 'top-right';
  if (overflowBottom) return overflowTop ? 'top-left' : 'bottom-left';
  return 'top-left';
}
