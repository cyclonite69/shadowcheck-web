import React, { useState } from 'react';
import { useGeocodingCache } from '../hooks/useGeocodingCache';
import { GeocodingDaemonCard } from './geocoding/GeocodingDaemonCard';
import { GeocodingRunsCard } from './geocoding/GeocodingRunsCard';
import { GeocodingStatsCard } from './geocoding/GeocodingStatsCard';

type AddressProvider = 'mapbox' | 'nominatim' | 'opencage' | 'geocodio' | 'locationiq';

export const GeocodingTab: React.FC = () => {
  const [limit, setLimit] = useState(1000);
  const [precision, setPrecision] = useState(4);
  const [perMinute, setPerMinute] = useState(60);
  const [permanent, setPermanent] = useState(false);
  const [addressProvider, setAddressProvider] = useState<AddressProvider>('locationiq');
  const [daemonLimit, setDaemonLimit] = useState(250);
  const [daemonPerMinute, setDaemonPerMinute] = useState(60);
  const [loopDelayMs, setLoopDelayMs] = useState(15000);
  const [idleSleepMs, setIdleSleepMs] = useState(180000);
  const [errorSleepMs, setErrorSleepMs] = useState(60000);
  const [daemonAddressProvider, setDaemonAddressProvider] = useState<AddressProvider>('locationiq');
  const [daemonPermanent, setDaemonPermanent] = useState(false);

  const {
    stats,
    daemon,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    lastResult,
    probeLoading,
    probeResult,
    refreshStats,
    runGeocoding,
    testProvider,
    startDaemon,
    stopDaemon,
  } = useGeocodingCache(precision);

  const [hasInitialized, setHasInitialized] = React.useState(false);

  React.useEffect(() => {
    if (daemon?.config && !hasInitialized) {
      const { config } = daemon;
      setDaemonLimit(config.limit);
      setPrecision(config.precision);
      setDaemonPerMinute(config.perMinute);
      setDaemonAddressProvider(config.provider as AddressProvider);
      setDaemonPermanent(Boolean(config.permanent));
      setLoopDelayMs(config.loopDelayMs);
      setIdleSleepMs(config.idleSleepMs);
      setErrorSleepMs(config.errorSleepMs);
      setHasInitialized(true);
    }
  }, [daemon?.config, hasInitialized]);

  const runAddressPass = async () => {
    await runGeocoding({
      provider: addressProvider,
      mode: 'address-only',
      limit,
      precision,
      perMinute,
      permanent: addressProvider === 'mapbox' ? permanent : false,
    });
  };

  const runPoiPass = async () => {
    await runGeocoding({
      provider: 'overpass',
      mode: 'poi-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackPass = async () => {
    await runGeocoding({
      provider: 'nominatim',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackOpenCage = async () => {
    await runGeocoding({
      provider: 'opencage',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackLocationIq = async () => {
    await runGeocoding({
      provider: 'locationiq',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackGeocodio = async () => {
    await runGeocoding({
      provider: 'geocodio',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const testSelectedProvider = async () => {
    await testProvider({
      provider: addressProvider,
      mode: 'address-only',
      limit,
      precision,
      perMinute,
      permanent: addressProvider === 'mapbox' ? permanent : false,
    });
  };

  const applyPersistedDaemonConfig = () => {
    if (!daemon?.config) return;
    setDaemonLimit(daemon.config.limit);
    setPrecision(daemon.config.precision);
    setDaemonPerMinute(daemon.config.perMinute);
    setDaemonAddressProvider(daemon.config.provider as AddressProvider);
    setDaemonPermanent(Boolean(daemon.config.permanent));
    setLoopDelayMs(daemon.config.loopDelayMs);
    setIdleSleepMs(daemon.config.idleSleepMs);
    setErrorSleepMs(daemon.config.errorSleepMs);
  };

  const startContinuousDaemon = async () => {
    await startDaemon({
      provider: daemonAddressProvider,
      mode: 'address-only',
      limit: daemonLimit,
      precision,
      perMinute: daemonPerMinute,
      permanent: daemonAddressProvider === 'mapbox' ? daemonPermanent : false,
      loopDelayMs,
      idleSleepMs,
      errorSleepMs,
      providers: [
        {
          provider: daemonAddressProvider,
          mode: 'address-only',
          limit: daemonLimit,
          perMinute: daemonPerMinute,
          permanent: daemonAddressProvider === 'mapbox' ? daemonPermanent : false,
          enabled: true,
        },
        {
          provider: 'overpass',
          mode: 'poi-only',
          limit: Math.max(25, Math.min(daemonLimit, 250)),
          perMinute: Math.min(daemonPerMinute, 60),
          permanent: false,
          enabled: true,
        },
      ],
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GeocodingStatsCard stats={stats} isLoading={isLoading} refreshStats={refreshStats} />
      <GeocodingDaemonCard
        daemon={daemon}
        actionLoading={actionLoading}
        precision={precision}
        setPrecision={setPrecision}
        daemonLimit={daemonLimit}
        setDaemonLimit={setDaemonLimit}
        daemonPerMinute={daemonPerMinute}
        setDaemonPerMinute={setDaemonPerMinute}
        loopDelayMs={loopDelayMs}
        setLoopDelayMs={setLoopDelayMs}
        idleSleepMs={idleSleepMs}
        setIdleSleepMs={setIdleSleepMs}
        errorSleepMs={errorSleepMs}
        setErrorSleepMs={setErrorSleepMs}
        daemonAddressProvider={daemonAddressProvider}
        setDaemonAddressProvider={setDaemonAddressProvider}
        daemonPermanent={daemonPermanent}
        setDaemonPermanent={setDaemonPermanent}
        applyPersistedDaemonConfig={applyPersistedDaemonConfig}
        startContinuousDaemon={startContinuousDaemon}
        stopDaemon={stopDaemon}
      />
      <GeocodingRunsCard
        stats={stats}
        daemon={daemon}
        actionLoading={actionLoading}
        probeLoading={probeLoading}
        actionMessage={actionMessage}
        error={error}
        lastResult={lastResult}
        probeResult={probeResult}
        limit={limit}
        setLimit={setLimit}
        precision={precision}
        setPrecision={setPrecision}
        perMinute={perMinute}
        setPerMinute={setPerMinute}
        permanent={permanent}
        setPermanent={setPermanent}
        addressProvider={addressProvider}
        setAddressProvider={setAddressProvider}
        runAddressPass={runAddressPass}
        runPoiPass={runPoiPass}
        runFallbackPass={runFallbackPass}
        runFallbackOpenCage={runFallbackOpenCage}
        runFallbackGeocodio={runFallbackGeocodio}
        runFallbackLocationIq={runFallbackLocationIq}
        testSelectedProvider={testSelectedProvider}
      />
    </div>
  );
};
