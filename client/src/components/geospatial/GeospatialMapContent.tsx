import React from 'react';
import { MapSection } from './MapSection';
import { MapToolbarActions } from './toolbar/MapToolbarActions';
import { MAP_STYLES } from '../../constants/network';
import { fitBoundsWithZoomInset } from '../../utils/geospatial/mapViewUtils';
import { usePinDropStore } from '../../stores/pinDropStore';

interface GeospatialMapContentProps {
  state: any;
  selectedNetworks: Set<string>;
  toggleWigleForBssids: (bssids: string[]) => void;
  wigleObservations: any;
  onOpenContextMenu: (e: React.MouseEvent, network: any) => void;
  showNetworkSummaries?: boolean;
  onToggleNetworkSummaries?: (value: boolean) => void;
  showMediaLocations?: boolean;
  onToggleMediaLocations?: (value: boolean) => void;
}

const GeospatialMapContentComponent: React.FC<GeospatialMapContentProps> = ({
  state,
  selectedNetworks,
  toggleWigleForBssids,
  wigleObservations,
  onOpenContextMenu,
  showNetworkSummaries = false,
  onToggleNetworkSummaries,
  showMediaLocations = false,
  onToggleMediaLocations,
}) => {
  const pinDropActive = usePinDropStore((s) => s.active);
  const cancelPinDrop = usePinDropStore((s) => s.cancel);

  return (
    <div style={{ position: 'relative' }}>
      {pinDropActive && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(6,182,212,0.92)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            padding: '6px 16px',
            borderRadius: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          <span>📍 Click map to set radius center</span>
          <button
            onClick={cancelPinDrop}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '1px 7px',
            }}
          >
            Esc
          </button>
        </div>
      )}
      <MapSection
        mapHeight={state.mapHeight}
        title="ShadowCheck Geospatial Intelligence"
        toolbar={
          <MapToolbarActions
            {...state}
            locationSearchRef={state.locationSearchRef}
            onSelectSearchResult={(res) => {
              if (state.searchMode === 'directions') {
                const dest: [number, number] = [res.center[0], res.center[1]];
                const origin = state.homeLocation.center;
                state.fetchRoute(origin, dest).then((data: any) => {
                  if (data && state.mapRef.current && state.mapboxRef.current) {
                    const bounds = new state.mapboxRef.current.LngLatBounds(origin, origin).extend(
                      dest
                    );
                    data.coordinates.forEach((c: any) => bounds.extend(c));
                    fitBoundsWithZoomInset(state.mapRef.current, bounds, {
                      padding: 60,
                      duration: 2000,
                    });
                  }
                });
                state.setShowSearchResults(false);
                state.setLocationSearch('');
              } else {
                state.flyToLocation(res);
              }
            }}
            onSearchModeToggle={() => {
              const next = state.searchMode === 'address' ? 'directions' : 'address';
              state.setSearchMode(next);
              if (next === 'address') {
                state.clearRoute();
              }
            }}
            onMapStyleChange={state.changeMapStyle}
            mapStyles={MAP_STYLES}
            canFit={selectedNetworks.size > 0}
            onWigle={() => toggleWigleForBssids(Array.from(selectedNetworks))}
            onToggleAgenciesPanel={state.toggleAgenciesPanel}
            onToggleCourthousesPanel={state.toggleCourthousesPanel}
            showCourthousesPanel={state.showCourthousesPanel}
            canWigle={selectedNetworks.size > 0}
            wigleLoading={wigleObservations.loading}
            wigleActive={(wigleObservations?.observations?.length ?? 0) > 0}
            selectedCount={selectedNetworks.size}
            showNetworkSummaries={showNetworkSummaries}
            onToggleNetworkSummaries={onToggleNetworkSummaries}
            showMediaLocations={showMediaLocations}
            onToggleMediaLocations={onToggleMediaLocations}
            mediaLocationStatus={state.mediaLocationStatus}
          />
        }
        mapError={state.mapError}
        mapReady={state.mapReady}
        embeddedView={state.embeddedView}
        mapRef={state.mapRef}
        mapContainerRef={state.mapContainerRef}
        onResizeMouseDown={state.handleMouseDown}
        onSnapPane={state.handlePaneSnap}
        onOpenContextMenu={onOpenContextMenu}
      />
    </div>
  );
};
export const GeospatialMapContent = React.memo(GeospatialMapContentComponent);
