import React from 'react';
import { MapSection } from './MapSection';
import { MapToolbarActions } from './MapToolbarActions';
import { MAP_STYLES } from '../../constants/network';
import { fitBoundsWithZoomInset } from '../../utils/geospatial/mapViewUtils';

interface GeospatialMapContentProps {
  state: any;
  selectedNetworks: Set<string>;
  toggleWigleForBssids: (bssids: string[]) => void;
  wigleObservations: any;
  onOpenContextMenu: (e: React.MouseEvent, network: any) => void;
  showNetworkSummaries?: boolean;
  onToggleNetworkSummaries?: (value: boolean) => void;
}

const GeospatialMapContentComponent: React.FC<GeospatialMapContentProps> = ({
  state,
  selectedNetworks,
  toggleWigleForBssids,
  wigleObservations,
  onOpenContextMenu,
  showNetworkSummaries = false,
  onToggleNetworkSummaries,
}) => (
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
          if (next === 'address') state.clearRoute();
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
        wigleActive={wigleObservations.observations.length > 0}
        selectedCount={selectedNetworks.size}
        showNetworkSummaries={showNetworkSummaries}
        onToggleNetworkSummaries={onToggleNetworkSummaries}
      />
    }
    mapError={state.mapError}
    mapReady={state.mapReady}
    embeddedView={state.embeddedView}
    mapRef={state.mapRef}
    mapContainerRef={state.mapContainerRef}
    onResizeMouseDown={state.handleMouseDown}
    onOpenContextMenu={onOpenContextMenu}
  />
);

export const GeospatialMapContent = React.memo(GeospatialMapContentComponent);
