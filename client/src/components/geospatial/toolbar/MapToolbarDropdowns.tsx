import React from 'react';
import { ChevronDownIcon, CheckIcon } from './MapToolbarIcons';
import type { GeospatialLayerOption } from '../layers/layerCatalog';

interface LayersDropdownProps {
  layersOpen: boolean;
  setLayersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  layersRef: React.RefObject<HTMLDivElement | null>;
  hasActiveLayers: boolean;
  onToggleAgenciesPanel?: () => void;
  showAgenciesPanel?: boolean;
  onToggleCourthousesPanel?: () => void;
  showCourthousesPanel?: boolean;
  onToggleAlprCameras?: () => void;
  showAlprCameras?: boolean;
  layerOptions?: GeospatialLayerOption[];
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const LayersDropdown = ({
  layersOpen,
  setLayersOpen,
  layersRef,
  hasActiveLayers,
  onToggleAgenciesPanel,
  showAgenciesPanel,
  onToggleCourthousesPanel,
  showCourthousesPanel,
  onToggleAlprCameras,
  showAlprCameras,
  layerOptions,
}: LayersDropdownProps) => {
  if (
    !layerOptions?.length &&
    !onToggleAgenciesPanel &&
    !onToggleCourthousesPanel &&
    !onToggleAlprCameras
  ) {
    return null;
  }

  return (
    <div ref={layersRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setLayersOpen((v) => !v)}
        style={{
          height: '28px',
          padding: '0 10px',
          borderRadius: '6px',
          border: hasActiveLayers
            ? '0.5px solid rgba(59,130,246,0.3)'
            : '0.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.03)',
          color: hasActiveLayers ? '#60a5fa' : 'rgba(255,255,255,0.5)',
          fontSize: '11px',
          ...mono,
          cursor: 'pointer',
        }}
      >
        Layers ▾
      </button>
      {layersOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: '#161b25',
            border: '0.5px solid rgba(59,130,246,0.15)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '230px',
            maxHeight: 'min(70vh, 560px)',
            overflowY: 'auto',
            zIndex: 200,
          }}
        >
          {layerOptions?.map((option) => (
            <div
              key={option.key}
              style={{
                padding: '6px 8px',
                borderRadius: '5px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  aria-pressed={option.visible}
                  onClick={option.onToggle}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 2px',
                    border: 0,
                    background: 'transparent',
                    color: option.visible ? option.color : 'rgba(255,255,255,0.5)',
                    fontSize: '12px',
                    textAlign: 'left',
                    ...mono,
                    cursor: 'pointer',
                  }}
                >
                  <span>{option.label}</span>
                  {option.visible && <CheckIcon color={option.color} />}
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.label} up`}
                  title="Move layer up"
                  onClick={option.onMoveUp}
                  style={layerOrderButtonStyle}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.label} down`}
                  title="Move layer down"
                  onClick={option.onMoveDown}
                  style={layerOrderButtonStyle}
                >
                  ↓
                </button>
              </div>
              {option.visible && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 2px 0',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '10px',
                    ...mono,
                  }}
                >
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(option.opacity * 100)}
                    aria-label={`${option.label} opacity`}
                    onChange={(event) => option.onOpacityChange(Number(event.target.value) / 100)}
                    style={{ flex: 1, accentColor: option.color }}
                  />
                  <span style={{ width: '28px', textAlign: 'right' }}>
                    {Math.round(option.opacity * 100)}%
                  </span>
                </label>
              )}
            </div>
          ))}
          {!layerOptions?.length && (
            <>
              {onToggleAgenciesPanel && (
                <div
                  onClick={() => {
                    onToggleAgenciesPanel();
                    setLayersOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    ...mono,
                    color: showAgenciesPanel ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span title="Show/hide US federal agency field offices on the map">Agencies</span>
                  {showAgenciesPanel && <CheckIcon />}
                </div>
              )}
              {onToggleCourthousesPanel && (
                <div
                  onClick={() => {
                    onToggleCourthousesPanel();
                    setLayersOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    ...mono,
                    color: showCourthousesPanel ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span title="Show/hide US federal courthouse locations on the map">
                    Federal Courthouses
                  </span>
                  {showCourthousesPanel && <CheckIcon />}
                </div>
              )}
              {onToggleAlprCameras && (
                <div
                  onClick={() => {
                    onToggleAlprCameras();
                    setLayersOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    ...mono,
                    color: showAlprCameras ? '#d946ef' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span title="Show/hide OpenStreetMap ALPR surveillance cameras on the map">
                    ALPR Cameras (OSM)
                  </span>
                  {showAlprCameras && <CheckIcon color="#d946ef" />}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const layerOrderButtonStyle: React.CSSProperties = {
  width: '22px',
  height: '22px',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '4px',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  fontSize: '12px',
  cursor: 'pointer',
};

interface MapStyleOption {
  value: string;
  label: string;
}

interface MapStyleDropdownProps {
  mapStyleOpen: boolean;
  setMapStyleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mapStyleRef: React.RefObject<HTMLDivElement | null>;
  currentStyleLabel: string;
  mapStyles: MapStyleOption[];
  mapStyle: string;
  onMapStyleChange: (value: string) => void;
}

export const MapStyleDropdown = ({
  mapStyleOpen,
  setMapStyleOpen,
  mapStyleRef,
  currentStyleLabel,
  mapStyles,
  mapStyle,
  onMapStyleChange,
}: MapStyleDropdownProps) => {
  return (
    <div ref={mapStyleRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMapStyleOpen((v) => !v)}
        style={{
          height: '28px',
          padding: '0 12px',
          borderRadius: '6px',
          border: '0.5px solid rgba(3,105,161,0.25)',
          background: 'rgba(3,105,161,0.12)',
          color: '#e5e7eb',
          fontSize: '11px',
          ...mono,
          cursor: 'pointer',
          minWidth: '160px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{currentStyleLabel}</span>
        <ChevronDownIcon />
      </button>
      {mapStyleOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#161b25',
            border: '0.5px solid rgba(3,105,161,0.25)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '200px',
            zIndex: 200,
          }}
        >
          {mapStyles.map((s) => (
            <div
              key={s.value}
              onClick={() => {
                onMapStyleChange(s.value);
                setMapStyleOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: '5px',
                fontSize: '12px',
                ...mono,
                color: mapStyle === s.value ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>{s.label}</span>
              {mapStyle === s.value && <CheckIcon />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
