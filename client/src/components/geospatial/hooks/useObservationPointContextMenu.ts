import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Map as MapboxMap, MapLayerMouseEvent } from 'mapbox-gl';
import type { NetworkRow } from '../../../types/network';

type ObservationPointContextMenuProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<MapboxMap | null>;
  mapStyle?: string;
  networkLookup: Map<string, NetworkRow>;
  onOpenContextMenu?: (e: any, network: any) => void;
};

export const useObservationPointContextMenu = ({
  mapReady,
  mapRef,
  mapStyle,
  networkLookup,
  onOpenContextMenu,
}: ObservationPointContextMenuProps) => {
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  const networkLookupRef = useRef(networkLookup);

  useEffect(() => {
    onOpenContextMenuRef.current = onOpenContextMenu;
    networkLookupRef.current = networkLookup;
  }, [onOpenContextMenu, networkLookup]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const handleContextMenu = (e: MapLayerMouseEvent) => {
      if (!onOpenContextMenuRef.current || !e.features || e.features.length === 0) {
        return;
      }

      const feature = e.features[0];
      const props = feature.properties;
      if (!props || !props.bssid) {
        return;
      }

      const network = networkLookupRef.current.get(props.bssid);
      if (network) {
        const mockEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: e.originalEvent.clientX,
          clientY: e.originalEvent.clientY,
          pageX: e.originalEvent.pageX,
          pageY: e.originalEvent.pageY,
        } as any;

        onOpenContextMenuRef.current(mockEvent, network);
      }
    };

    const bindContextMenu = () => {
      if (!map.getLayer('observation-points')) {
        return false;
      }

      map.off('contextmenu', 'observation-points', handleContextMenu);
      map.on('contextmenu', 'observation-points', handleContextMenu);
      return true;
    };

    if (bindContextMenu()) {
      return () => {
        map.off('contextmenu', 'observation-points', handleContextMenu);
      };
    }

    const handleStyleLoad = () => {
      bindContextMenu();
    };

    map.once('style.load', handleStyleLoad);
    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('contextmenu', 'observation-points', handleContextMenu);
    };
  }, [mapReady, mapRef, mapStyle]);
};
