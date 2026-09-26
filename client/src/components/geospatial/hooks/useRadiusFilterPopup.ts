import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { useCurrentFilters, useCurrentEnabled, useFilterStore } from '../../../stores/filterStore';

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

export function buildPopupHTML(radiusMeters: number): string {
  return `
    <div style="font-family:system-ui,sans-serif;min-width:210px;padding:4px 0">
      <div style="font-size:11px;font-weight:700;color:#67e8f9;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">
        Radius Search
      </div>
      <div style="margin-bottom:12px">
        <input type="range" id="radius-slider"
          min="100" max="50000" step="100" value="${radiusMeters}"
          style="width:100%;accent-color:#06b6d4;margin-bottom:8px;cursor:pointer"
        />
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" id="radius-input"
            min="100" max="50000" step="100" value="${radiusMeters}"
            style="width:80px;background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:4px;padding:3px 7px;font-size:12px"
          />
          <span style="color:#94a3b8;font-size:12px">meters</span>
        </div>
        <div id="radius-display" style="font-size:11px;color:#67e8f9;margin-top:5px">
          ${formatRadius(radiusMeters)}
        </div>
      </div>
      <button id="radius-clear"
        style="width:100%;padding:5px 0;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#f87171;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.04em"
      >
        Clear Pin
      </button>
    </div>
  `;
}

type Props = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<any | null>;
};

export const useRadiusFilterPopup = ({ mapReady, mapRef, mapboxRef }: Props) => {
  const popupRef = useRef<any>(null);
  const filters = useCurrentFilters();
  const enabled = useCurrentEnabled();
  const setFilter = useFilterStore((s) => s.setFilter);
  const enableFilter = useFilterStore((s) => s.enableFilter);

  // Stable refs so DOM event listeners never go stale
  const setFilterRef = useRef(setFilter);
  const enableFilterRef = useRef(enableFilter);
  const filtersRef = useRef(filters);
  useEffect(() => {
    setFilterRef.current = setFilter;
  }, [setFilter]);
  useEffect(() => {
    enableFilterRef.current = enableFilter;
  }, [enableFilter]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Attach click + cursor handlers on the pin layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;

    const openPopup = (e: any) => {
      if (!e.features?.length) {
        return;
      }
      const coords: [number, number] = e.features[0].geometry.coordinates.slice();
      const radiusMeters = e.features[0].properties?.radiusMeters ?? 500;

      popupRef.current?.remove();

      const mapboxgl = mapboxRef.current;
      if (!mapboxgl) {
        return;
      }

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '260px',
        className: 'sc-popup',
        anchor: 'bottom',
        offset: [0, -14],
      })
        .setLngLat(coords)
        .setHTML(buildPopupHTML(radiusMeters))
        .addTo(map);

      popupRef.current = popup;

      const el = popup.getElement();

      const syncDOM = (value: number) => {
        const clamped = Math.max(100, Math.min(50000, value));
        const current = filtersRef.current.radiusFilter;
        if (!current) {
          return;
        }
        setFilterRef.current('radiusFilter', { ...current, radiusMeters: clamped });
        const slider = el.querySelector('#radius-slider') as HTMLInputElement | null;
        const input = el.querySelector('#radius-input') as HTMLInputElement | null;
        const display = el.querySelector('#radius-display');
        if (slider) {
          slider.value = String(clamped);
        }
        if (input) {
          input.value = String(clamped);
        }
        if (display) {
          display.textContent = formatRadius(clamped);
        }
      };

      (el.querySelector('#radius-slider') as HTMLInputElement | null)?.addEventListener(
        'input',
        (ev) => syncDOM(Number((ev.target as HTMLInputElement).value))
      );
      (el.querySelector('#radius-input') as HTMLInputElement | null)?.addEventListener(
        'change',
        (ev) => syncDOM(Number((ev.target as HTMLInputElement).value))
      );
      el.querySelector('#radius-clear')?.addEventListener('click', () => {
        enableFilterRef.current('radiusFilter', false);
        popup.remove();
        popupRef.current = null;
      });
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', 'radius-filter-pin', openPopup);
    map.on('mouseenter', 'radius-filter-pin', onEnter);
    map.on('mouseleave', 'radius-filter-pin', onLeave);

    return () => {
      map.off('click', 'radius-filter-pin', openPopup);
      map.off('mouseenter', 'radius-filter-pin', onEnter);
      map.off('mouseleave', 'radius-filter-pin', onLeave);
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [mapReady, mapRef, mapboxRef]);

  // Close popup when filter is disabled
  useEffect(() => {
    if (!enabled.radiusFilter && popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [enabled.radiusFilter]);

  // Sync popup DOM when radiusFilter changes from outside (e.g., filter panel)
  useEffect(() => {
    const popup = popupRef.current;
    if (!popup || !filters.radiusFilter) {
      return;
    }
    const el = popup.getElement?.();
    if (!el) {
      return;
    }
    const { latitude: lat, longitude: lng, radiusMeters } = filters.radiusFilter;
    (el.querySelector('#radius-slider') as HTMLInputElement | null)?.setAttribute(
      'value',
      String(radiusMeters)
    );
    (el.querySelector('#radius-input') as HTMLInputElement | null)?.setAttribute(
      'value',
      String(radiusMeters)
    );
    const display = el.querySelector('#radius-display');
    if (display) {
      display.textContent = formatRadius(radiusMeters);
    }
    popup.setLngLat([lng, lat]);
  }, [filters.radiusFilter]);
};
