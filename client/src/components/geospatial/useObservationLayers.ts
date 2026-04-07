import type { MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import type { NetworkRow, Observation } from '../../types/network';
import { useCoreObservationLayers } from './useCoreObservationLayers';
import { useWigleLayers, type WigleObservationsState } from './useWigleLayers';
import { useSummaryLayers } from './useSummaryLayers';

type ObservationSet = {
  bssid: string;
  observations: Observation[];
};

type ObservationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapboxRef: MutableRefObject<typeof mapboxglType | null>;
  mapStyle?: string;
  activeObservationSets: ObservationSet[];
  networkLookup: Map<string, NetworkRow>;
  wigleObservations?: WigleObservationsState;
  isViewportLocked?: boolean;
  onOpenContextMenu?: (e: any, network: any) => void;
  showNetworkSummaries?: boolean;
};

/**
 * Orchestrator hook for all observation-related map layers.
 * Delegates to specialized hooks for core observations, WiGLE data, and summary markers.
 */
export const useObservationLayers = (props: ObservationLayerProps) => {
  // 1. Core observation points and lines
  useCoreObservationLayers({
    mapReady: props.mapReady,
    mapRef: props.mapRef,
    mapboxRef: props.mapboxRef,
    mapStyle: props.mapStyle,
    activeObservationSets: props.activeObservationSets,
    networkLookup: props.networkLookup,
    isViewportLocked: props.isViewportLocked,
  });

  // 2. WiGLE observation points and popups
  useWigleLayers({
    mapReady: props.mapReady,
    mapRef: props.mapRef,
    mapboxRef: props.mapboxRef,
    mapStyle: props.mapStyle,
    networkLookup: props.networkLookup,
    wigleObservations: props.wigleObservations,
    isViewportLocked: props.isViewportLocked,
    onOpenContextMenu: props.onOpenContextMenu,
  });

  // 3. Network summary markers (centroid/weighted)
  useSummaryLayers({
    mapReady: props.mapReady,
    mapRef: props.mapRef,
    mapboxRef: props.mapboxRef,
    mapStyle: props.mapStyle,
    activeObservationSets: props.activeObservationSets,
    networkLookup: props.networkLookup,
    showNetworkSummaries: props.showNetworkSummaries,
  });
};
