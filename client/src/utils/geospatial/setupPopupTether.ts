/**
 * Popup Tether Line Setup Utility
 * Draws a visual line connecting popup to the observation point
 * Updates dynamically as tooltip is dragged or map is panned/zoomed
 */

import type { Popup, Map, LngLatLike } from 'mapbox-gl';

export interface PopupTetherState {
  svgElement: SVGSVGElement | null;
  lineElement: SVGLineElement | null;
  lngLat: LngLatLike | null;
  map: Map | null;
  listeners: {
    mapMove: () => void;
    mapZoom: () => void;
  };
}

/**
 * Create and inject SVG overlay for tether line
 */
function createTetherSVG(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1000';
  svg.style.width = '100%';
  svg.style.height = '100%';

  return svg;
}

/**
 * Create line element for tether (no arrow)
 */
function createTetherLine(): SVGLineElement {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', 'white');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-dasharray', '4,4');
  line.setAttribute('opacity', '0.7');
  return line;
}

/**
 * Update tether line position based on popup and observation point (edge to edge)
 */
function updateTetherLine(
  lineElement: SVGLineElement,
  observationEdge: { x: number; y: number },
  popupEdge: { x: number; y: number }
): void {
  lineElement.setAttribute('x1', String(observationEdge.x));
  lineElement.setAttribute('y1', String(observationEdge.y));
  lineElement.setAttribute('x2', String(popupEdge.x));
  lineElement.setAttribute('y2', String(popupEdge.y));
}

/**
 * Get screen coordinates of observation point with offset to edge toward popup
 */
function getObservationScreenCoords(
  map: Map,
  lngLat: LngLatLike,
  popupCenter: { x: number; y: number },
  observationRadius: number = 6
): { x: number; y: number } {
  const point = map.project(lngLat);
  const canvasRect = map.getCanvas().getBoundingClientRect();
  const obsScreenX = point.x + canvasRect.left;
  const obsScreenY = point.y + canvasRect.top;

  // Calculate direction from observation point to popup center
  const dx = popupCenter.x - obsScreenX;
  const dy = popupCenter.y - obsScreenY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { x: obsScreenX, y: obsScreenY };
  }

  // Move from center toward popup edge by observationRadius
  const ratio = observationRadius / distance;
  return {
    x: obsScreenX + dx * ratio,
    y: obsScreenY + dy * ratio,
  };
}

/**
 * Get popup edge coordinates (edge closest to observation point)
 */
function getPopupEdgeCoords(
  popupElement: HTMLElement,
  observationPoint: { x: number; y: number }
): { x: number; y: number } {
  const rect = popupElement.getBoundingClientRect();
  const popupCenterX = rect.left + rect.width / 2;
  const popupCenterY = rect.top + rect.height / 2;

  // Calculate direction from popup center to observation point
  const dx = observationPoint.x - popupCenterX;
  const dy = observationPoint.y - popupCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { x: popupCenterX, y: popupCenterY };
  }

  // Determine which edge of popup is closest
  const normalizedDx = dx / distance;
  const normalizedDy = dy / distance;

  let edgeX = popupCenterX;
  let edgeY = popupCenterY;

  // Clamp to popup box edges
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  if (Math.abs(normalizedDx) > Math.abs(normalizedDy)) {
    // Hit left or right edge
    edgeX = normalizedDx > 0 ? rect.left + rect.width : rect.left;
    edgeY = popupCenterY;
  } else {
    // Hit top or bottom edge
    edgeX = popupCenterX;
    edgeY = normalizedDy > 0 ? rect.top + rect.height : rect.top;
  }

  return { x: edgeX, y: edgeY };
}

/**
 * Get popup center screen coordinates
 */
function getPopupCenter(popupElement: HTMLElement): { x: number; y: number } {
  const rect = popupElement.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Setup tether line from popup to observation point (edge to edge)
 */
export function setupPopupTether(popup: Popup, map: Map, lngLat: LngLatLike): PopupTetherState {
  const popupElement = popup.getElement();
  if (!popupElement) {
    return {
      svgElement: null,
      lineElement: null,
      lngLat: null,
      map: null,
      listeners: { mapMove: () => {}, mapZoom: () => {} },
    };
  }

  // Get or create map container for SVG overlay
  const mapContainer = map.getContainer();
  let svgElement = mapContainer.querySelector('svg[data-tether="true"]') as SVGSVGElement | null;

  if (!svgElement) {
    svgElement = createTetherSVG();
    svgElement.setAttribute('data-tether', 'true');
    mapContainer.appendChild(svgElement);
  }

  // Create line element
  const lineElement = createTetherLine();
  svgElement.appendChild(lineElement);

  // Initialize tether state
  const tetherState: PopupTetherState = {
    svgElement,
    lineElement,
    lngLat,
    map,
    listeners: { mapMove: () => {}, mapZoom: () => {} },
  };

  // Update line position initially
  const popupCenterCoords = { x: 0, y: 0 }; // Temporary, will be recalculated below
  const popupRect = popupElement.getBoundingClientRect();
  const popupCenter = {
    x: popupRect.left + popupRect.width / 2,
    y: popupRect.top + popupRect.height / 2,
  };
  const obsEdge = getObservationScreenCoords(map, lngLat, popupCenter);
  const popupEdge = getPopupEdgeCoords(popupElement, obsEdge);
  updateTetherLine(lineElement, obsEdge, popupEdge);

  // Create update handler
  const updateTether = () => {
    if (!tetherState.lineElement || !tetherState.map || !tetherState.lngLat) {
      return;
    }

    const popupRect = popupElement.getBoundingClientRect();
    const popupCenter = {
      x: popupRect.left + popupRect.width / 2,
      y: popupRect.top + popupRect.height / 2,
    };
    const obsEdge = getObservationScreenCoords(tetherState.map, tetherState.lngLat, popupCenter);
    const popupEdge = getPopupEdgeCoords(popupElement, obsEdge);
    updateTetherLine(tetherState.lineElement, obsEdge, popupEdge);
  };

  // Assign listeners
  tetherState.listeners.mapMove = updateTether;
  tetherState.listeners.mapZoom = updateTether;

  // Attach map event listeners
  map.on('move', tetherState.listeners.mapMove);
  map.on('zoom', tetherState.listeners.mapZoom);

  return tetherState;
}

/**
 * Update tether line during popup drag (edge to edge)
 */
export function updateTetherDuringDrag(
  tetherState: PopupTetherState,
  popupElement: HTMLElement
): void {
  if (!tetherState.lineElement || !tetherState.map || !tetherState.lngLat) {
    return;
  }

  const popupRect = popupElement.getBoundingClientRect();
  const popupCenter = {
    x: popupRect.left + popupRect.width / 2,
    y: popupRect.top + popupRect.height / 2,
  };
  const obsEdge = getObservationScreenCoords(tetherState.map, tetherState.lngLat, popupCenter);
  const popupEdge = getPopupEdgeCoords(popupElement, obsEdge);
  updateTetherLine(tetherState.lineElement, obsEdge, popupEdge);
}

/**
 * Cleanup tether line and event listeners
 */
export function cleanupPopupTether(tetherState: PopupTetherState): void {
  // Remove event listeners
  if (tetherState.map) {
    tetherState.map.off('move', tetherState.listeners.mapMove);
    tetherState.map.off('zoom', tetherState.listeners.mapZoom);
  }

  // Remove line element from SVG
  if (tetherState.lineElement && tetherState.lineElement.parentNode) {
    tetherState.lineElement.parentNode.removeChild(tetherState.lineElement);
  }

  // Remove SVG if no other lines exist
  if (tetherState.svgElement) {
    const lines = tetherState.svgElement.querySelectorAll('line');
    if (lines.length === 0 && tetherState.svgElement.parentNode) {
      tetherState.svgElement.parentNode.removeChild(tetherState.svgElement);
    }
  }
}
