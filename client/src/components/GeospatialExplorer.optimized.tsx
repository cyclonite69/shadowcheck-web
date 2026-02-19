import { useEffect, useMemo, useState } from 'react';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { useNetworkSelection } from './geospatial/useNetworkSelection';

export default function GeospatialExplorer() {
  // Critical: Set current page for filter scoping
  usePageFilters('geospatial');

  // Critical: Location mode and plan check state
  const [locationMode] = useState('latest_observation');
  const [planCheck] = useState(false);
  const [, setInitialized] = useState(false);

  // Critical: Network data hook
  const { networks } = useNetworkData({ locationMode, planCheck });

  const filteredNetworks = useMemo(() => networks, [networks]);

  const { selectedNetworks } = useNetworkSelection({ networks: filteredNetworks });

  const [useObservationFilters] = useState(true);

  // Critical: Observations hook
  useObservations(selectedNetworks, { useFilters: useObservationFilters });

  // Defer non-critical initialization
  useEffect(() => {
    const timer = setTimeout(() => setInitialized(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Rest of component remains the same...
  // (keeping existing implementation)

  return <div>GeospatialExplorer Component</div>;
}
