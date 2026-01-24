import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type mapboxglType from 'mapbox-gl';
import { createCirclePolygon } from '../../utils/mapHelpers';

type HomeLocation = {
  center: [number, number];
  radius: number;
};

type HomeLocationLayerProps = {
  mapReady: boolean;
  mapRef: MutableRefObject<mapboxglType.Map | null>;
  homeLocation: HomeLocation;
};

export const useHomeLocationLayer = ({
  mapReady,
  mapRef,
  homeLocation,
}: HomeLocationLayerProps) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Update point source
    const pointSource = map.getSource('home-location-point') as mapboxglType.GeoJSONSource;
    if (pointSource) {
      pointSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: homeLocation.center,
            },
            properties: { title: 'Home' },
          },
        ],
      });
    }

    // Update circle source
    const circleSource = map.getSource('home-location-circle') as mapboxglType.GeoJSONSource;
    if (circleSource) {
      circleSource.setData({
        type: 'FeatureCollection',
        features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
      });
    }
  }, [mapReady, mapRef, homeLocation]);
};
