import React from 'react';
import { ChevronDownIcon, CheckIcon } from './MapToolbarIcons';

interface LayersDropdownProps {
  layersOpen: boolean;
  setLayersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  layersRef: React.RefObject<HTMLDivElement | null>;
  hasActiveLayers: boolean;
  onToggleAgenciesPanel?: () => void;
  showAgenciesPanel?: boolean;
  onToggleCourthousesPanel?: () => void;
  showCourthousesPanel?: boolean;
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
}: LayersDropdownProps) => {
  if (!onToggleAgenciesPanel && !onToggleCourthousesPanel) return null;

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
            minWidth: '180px',
            zIndex: 200,
          }}
        >
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
              <span>Agencies</span>
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
              <span>Federal Courthouses</span>
              {showCourthousesPanel && <CheckIcon />}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
