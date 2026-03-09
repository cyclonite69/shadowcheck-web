import { useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';

type HomeLocationState = { lat: string; lng: string; radius: string };

export const useConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [mapboxUnlimitedApiKey, setMapboxUnlimitedApiKey] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('');
  const [opencageApiKey, setOpencageApiKey] = useState('');
  const [locationIqApiKey, setLocationIqApiKey] = useState('');
  const [smartyAuthId, setSmartyAuthId] = useState('');
  const [smartyAuthToken, setSmartyAuthToken] = useState('');
  const [mapboxConfigured, setMapboxConfigured] = useState(false);
  const [mapboxUnlimitedConfigured, setMapboxUnlimitedConfigured] = useState(false);
  const [googleMapsConfigured, setGoogleMapsConfigured] = useState(false);
  const [wigleConfigured, setWigleConfigured] = useState(false);
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [opencageConfigured, setOpencageConfigured] = useState(false);
  const [locationIqConfigured, setLocationIqConfigured] = useState(false);
  const [smartyConfigured, setSmartyConfigured] = useState(false);
  const [wigleApiName, setWigleApiName] = useState('');
  const [wigleApiToken, setWigleApiToken] = useState('');
  const [homeLocation, setHomeLocation] = useState<HomeLocationState>({
    lat: '',
    lng: '',
    radius: '1000',
  });
  const [homeLocationLoading, setHomeLocationLoading] = useState(true);
  const [homeLocationError, setHomeLocationError] = useState<string | null>(null);
  const [homeLocationConfigured, setHomeLocationConfigured] = useState(false);
  const [homeLocationLastUpdated, setHomeLocationLastUpdated] = useState<string | null>(null);

  const saveMapboxToken = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveMapboxToken(mapboxToken);
      setMapboxConfigured(true);
      alert('Mapbox token saved!');
    } catch (error) {
      alert(`Error saving token: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMapboxUnlimitedApiKey = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveMapboxUnlimited(mapboxUnlimitedApiKey);
      setMapboxUnlimitedConfigured(true);
      alert('Mapbox geocoding key saved!');
    } catch (error) {
      alert(`Error saving Mapbox geocoding key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWigleCredentials = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveWigleToken(wigleApiToken);
      setWigleConfigured(true);
      alert('WiGLE credentials saved!');
    } catch (error) {
      alert(`Error saving credentials: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGoogleMapsApiKey = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveGoogleMapsKey(googleMapsApiKey);
      setGoogleMapsConfigured(true);
      alert('Google Maps API key saved!');
    } catch (error) {
      alert(`Error saving API key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAwsRegion = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveAwsRegion(awsRegion);
      setAwsConfigured(true);
      alert('AWS region saved. Runtime credentials provider chain is active.');
    } catch (error) {
      alert(`Error saving AWS region: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOpencageApiKey = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveOpenCageKey(opencageApiKey);
      setOpencageConfigured(true);
      alert('OpenCage API key saved!');
    } catch (error) {
      alert(`Error saving OpenCage key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLocationIqApiKey = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveLocationIQKey(locationIqApiKey);
      setLocationIqConfigured(true);
      alert('LocationIQ API key saved!');
    } catch (error) {
      alert(`Error saving LocationIQ key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSmartyCredentials = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveSmartyKey(smartyAuthId, smartyAuthToken);
      setSmartyConfigured(true);
      alert('Smarty credentials saved!');
    } catch (error) {
      alert(`Error saving Smarty credentials: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHomeLocation = async () => {
    const lat = parseFloat(homeLocation.lat);
    const lng = parseFloat(homeLocation.lng);
    const radius = parseInt(homeLocation.radius, 10);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setHomeLocationError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setHomeLocationError('Longitude must be a number between -180 and 180.');
      return;
    }
    if (!Number.isInteger(radius) || radius <= 0) {
      setHomeLocationError('Radius must be a positive integer.');
      return;
    }

    try {
      setIsLoading(true);
      setHomeLocationError(null);
      await adminApi.saveHomeLocation(lat, lng, radius);
      setHomeLocationConfigured(true);
      setHomeLocationLastUpdated(new Date().toISOString());
      alert('Home location saved!');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save home location right now.';
      setHomeLocationError(message);
      alert('Error saving location');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadMaskedConfig = async () => {
      try {
        const [
          mapboxRes,
          mapboxUnlimitedRes,
          googleRes,
          wigleRes,
          awsRes,
          opencageRes,
          locationIqRes,
          smartyRes,
        ] = await Promise.all([
          adminApi.getMapboxToken(),
          adminApi.getMapboxUnlimited(),
          adminApi.getGoogleMapsKey(),
          adminApi.getWigleToken(),
          adminApi.getAwsSettings(),
          adminApi.getOpenCageKey(),
          adminApi.getLocationIQKey(),
          adminApi.getSmartyKey(),
        ]);

        if (mapboxRes) {
          if (typeof mapboxRes.configured === 'boolean') {
            setMapboxConfigured(mapboxRes.configured);
          } else {
            const tokens = Array.isArray(mapboxRes.tokens) ? mapboxRes.tokens : [];
            setMapboxConfigured(tokens.length > 0);
          }
        }
        if (mapboxUnlimitedRes) {
          setMapboxUnlimitedConfigured(Boolean(mapboxUnlimitedRes.configured));
        }
        if (googleRes) {
          setGoogleMapsConfigured(Boolean(googleRes.configured));
        }
        if (wigleRes) {
          setWigleConfigured(Boolean(wigleRes.configured));
        }
        if (awsRes) {
          setAwsConfigured(Boolean(awsRes.configured));
          if (awsRes.region && !awsRegion) {
            setAwsRegion(awsRes.region);
          }
        }
        if (opencageRes) {
          setOpencageConfigured(Boolean(opencageRes.configured));
        }
        if (locationIqRes) {
          setLocationIqConfigured(Boolean(locationIqRes.configured));
        }
        if (smartyRes) {
          setSmartyConfigured(Boolean(smartyRes.configured));
        }
      } catch {
        setMapboxConfigured(false);
        setMapboxUnlimitedConfigured(false);
        setGoogleMapsConfigured(false);
        setWigleConfigured(false);
        setAwsConfigured(false);
        setOpencageConfigured(false);
        setLocationIqConfigured(false);
        setSmartyConfigured(false);
      }
    };

    const loadHomeLocation = async () => {
      setHomeLocationLoading(true);
      setHomeLocationError(null);
      try {
        const location = await adminApi.getHomeLocation();
        if (
          location &&
          typeof location.latitude === 'number' &&
          typeof location.longitude === 'number'
        ) {
          setHomeLocation({
            lat: String(location.latitude),
            lng: String(location.longitude),
            radius: String(location.radius ?? 1000),
          });
          setHomeLocationConfigured(true);
          setHomeLocationLastUpdated(location.lastUpdated ?? null);
        } else {
          setHomeLocationConfigured(false);
        }
      } catch (error) {
        setHomeLocationConfigured(false);
        const message = error instanceof Error ? error.message : '';
        if (message && !message.includes('404')) {
          setHomeLocationError('Failed to load current home location.');
        }
      } finally {
        setHomeLocationLoading(false);
      }
    };

    loadMaskedConfig();
    loadHomeLocation();
  }, []);

  return {
    isLoading,
    mapboxToken,
    setMapboxToken,
    mapboxUnlimitedApiKey,
    setMapboxUnlimitedApiKey,
    googleMapsApiKey,
    setGoogleMapsApiKey,
    awsRegion,
    setAwsRegion,
    opencageApiKey,
    setOpencageApiKey,
    locationIqApiKey,
    setLocationIqApiKey,
    smartyAuthId,
    setSmartyAuthId,
    smartyAuthToken,
    setSmartyAuthToken,
    mapboxConfigured,
    mapboxUnlimitedConfigured,
    googleMapsConfigured,
    wigleConfigured,
    awsConfigured,
    opencageConfigured,
    locationIqConfigured,
    smartyConfigured,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    homeLocation,
    setHomeLocation,
    homeLocationLoading,
    homeLocationError,
    homeLocationConfigured,
    homeLocationLastUpdated,
    saveMapboxToken,
    saveMapboxUnlimitedApiKey,
    saveGoogleMapsApiKey,
    saveAwsRegion,
    saveOpencageApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveWigleCredentials,
    saveHomeLocation,
  };
};
