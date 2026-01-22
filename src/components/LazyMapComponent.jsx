import React, { Suspense, lazy } from 'react';

const MapComponent = lazy(() => import('./GeospatialExplorer'));

export default function LazyMapComponent(props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-3 py-8 text-slate-300">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading map...</span>
        </div>
      }
    >
      <MapComponent {...props} />
    </Suspense>
  );
}
