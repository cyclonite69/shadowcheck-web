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

  // Add marker definition for arrowhead
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'tether-arrow');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '3');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');

  const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  markerPath.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
  markerPath.setAttribute('fill', 'white');
  markerPath.setAttribute('opacity', '0.8');

  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  return svg;
}

/**
 * Create line element for tether
 */
function createTetherLine(): SVGLineElement {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', 'white');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-dasharray', '4,4');
  line.setAttribute('opacity', '0.8');
  line.setAttribute('marker-end', 'url(#tether-arrow)');
  return line;
}

/**
 * Update tether line position based on popup and observation point
 */
function updateTetherLine(
  lineElement: SVGLineElement,
  observationPoint: { x: number; y: number },
  popupCenter: { x: number; y: number }
): void {
  lineElement.setAttribute('x1', String(observationPoint.x));
  lineElement.setAttribute('y1', String(observationPoint.y));
  lineElement.setAttribute('x2', String(popupCenter.x));
  lineElement.setAttribute('y2', String(popupCenter.y));
}

/**
 * Get screen coordinates of observation point
 */
function getObservationScreenCoords(map: Map, lngLat: LngLatLike): { x: number; y: number } {
  const point = map.project(lngLat);
  const canvasRect = map.getCanvas().getBoundingClientRect();
  return {
    x: point.x + canvasRect.left,
    y: point.y + canvasRect.top,
  };
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
 * Setup tether line from popup to observation point
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
  const obsCoords = getObservationScreenCoords(map, lngLat);
  const popupCoords = getPopupCenter(popupElement);
  updateTetherLine(lineElement, obsCoords, popupCoords);

  // Create update handler
  const updateTether = () => {
    if (!tetherState.lineElement || !tetherState.map || !tetherState.lngLat) {
      return;
    }

    const obsCoords = getObservationScreenCoords(tetherState.map, tetherState.lngLat);
    const popupCoords = getPopupCenter(popupElement);
    updateTetherLine(tetherState.lineElement, obsCoords, popupCoords);
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
 * Update tether line during popup drag
 */
export function updateTetherDuringDrag(
  tetherState: PopupTetherState,
  popupElement: HTMLElement
): void {
  if (!tetherState.lineElement || !tetherState.map || !tetherState.lngLat) {
    return;
  }

  const obsCoords = getObservationScreenCoords(tetherState.map, tetherState.lngLat);
  const popupCoords = getPopupCenter(popupElement);
  updateTetherLine(tetherState.lineElement, obsCoords, popupCoords);
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
