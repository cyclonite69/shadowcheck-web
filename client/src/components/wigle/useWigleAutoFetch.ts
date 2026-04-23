import { useEffect, useRef } from 'react';

export function useWigleAutoFetch({
  mapReady,
  layers,
  v2Rows,
  v3Rows,
  kmlRows,
  v2Loading,
  v3Loading,
  kmlLoading,
  adaptedFilters,
  fetchPoints,
  fetchKmlPoints,
  autoFetchedRef,
}: any): void {
  const hasV2DataRef = useRef(false);
  const hasV3DataRef = useRef(false);
  const hasKmlDataRef = useRef(false);

  // Auto-fetch on layer toggle
  useEffect(() => {
    if (!mapReady) return;

    if (!layers.v2) autoFetchedRef.current.v2 = false;
    if (!layers.v3) autoFetchedRef.current.v3 = false;

    const needsV2 = layers.v2 && v2Rows.length === 0 && !v2Loading && !autoFetchedRef.current.v2;
    const needsV3 = layers.v3 && v3Rows.length === 0 && !v3Loading && !autoFetchedRef.current.v3;
    const needsKml = layers.kml && kmlRows.length === 0 && !kmlLoading;

    if (needsV2 || needsV3) {
      if (needsV2) autoFetchedRef.current.v2 = true;
      if (needsV3) autoFetchedRef.current.v3 = true;
      fetchPoints().then(() => {
        hasV2DataRef.current = layers.v2 && v2Rows.length > 0;
        hasV3DataRef.current = layers.v3 && v3Rows.length > 0;
      });
    }
    if (needsKml) {
      fetchKmlPoints().then(() => {
        hasKmlDataRef.current = layers.kml && kmlRows.length > 0;
      });
    }
  }, [
    layers.v2,
    layers.v3,
    layers.kml,
    mapReady,
    v2Rows.length,
    v3Rows.length,
    kmlRows.length,
    v2Loading,
    v3Loading,
    kmlLoading,
    fetchPoints,
    fetchKmlPoints,
  ]);

  // Refetch when filters change (if data already loaded)
  useEffect(() => {
    if (!mapReady) return;

    if ((layers.v2 && hasV2DataRef.current) || (layers.v3 && hasV3DataRef.current)) {
      fetchPoints();
    }
    if (layers.kml && hasKmlDataRef.current) {
      fetchKmlPoints();
    }
  }, [adaptedFilters, mapReady, layers.v2, layers.v3, layers.kml, fetchPoints, fetchKmlPoints]);
}
