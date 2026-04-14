import type { LngLatLike, Map } from 'mapbox-gl';

type PopupAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function measurePopupSize(container: HTMLElement, html: string): { width: number; height: number } {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.left = '0';
  probe.style.top = '0';
  probe.style.zIndex = '-1';
  probe.innerHTML = html;
  container.appendChild(probe);

  const measured = (probe.firstElementChild as HTMLElement | null) ?? probe;
  const rect = measured.getBoundingClientRect();
  container.removeChild(probe);

  return {
    width: rect.width || 288,
    height: rect.height || 220,
  };
}

export function getPopupAnchor(map: Map, lngLat: LngLatLike, html: string): PopupAnchor {
  const container = map.getContainer();
  const { width: tooltipWidth, height: tooltipHeight } = measurePopupSize(container, html);
  const point = map.project(lngLat);
  const bounds = container.getBoundingClientRect();
  const gap = 15;

  const overflowRight = point.x + gap + tooltipWidth > bounds.width;
  const overflowBottom = point.y + gap + tooltipHeight > bounds.height;
  const overflowTop = point.y - gap - tooltipHeight < 0;

  // When overflowBottom would open the tooltip upward, verify there is room above.
  // If not, fall back to opening downward (top anchor) even if it clips the bottom —
  // that is less disruptive than disappearing off the top of the viewport.
  if (overflowRight && overflowBottom) return overflowTop ? 'top-right' : 'bottom-right';
  if (overflowRight) return 'top-right';
  if (overflowBottom) return overflowTop ? 'top-left' : 'bottom-left';
  return 'top-left';
}
