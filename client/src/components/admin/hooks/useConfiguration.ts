import { useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';

type HomeLocationState = { lat: string; lng: string; radius: string };
type SavedConfigurationValues = {
  mapboxToken: string;
  mapboxUnlimitedApiKey: string;
  googleMapsApiKey: string;
  awsRegion: string;
  opencageApiKey: string;
  geocodioApiKey: string;
  locationIqApiKey: string;
  smartyAuthId: string;
  smartyAuthToken: string;
  wigleApiName: string;
  wigleApiToken: string;
  homeLocation: HomeLocationState;
};

const EMPTY_HOME_LOCATION: HomeLocationState = {
  lat: '',
  lng: '',
  radius: '1000',
};

const EMPTY_SAVED_VALUES: SavedConfigurationValues = {
  mapboxToken: '',
  mapboxUnlimitedApiKey: '',
  googleMapsApiKey: '',
  awsRegion: '',
  opencageApiKey: '',
  geocodioApiKey: '',
  locationIqApiKey: '',
  smartyAuthId: '',
  smartyAuthToken: '',
  wigleApiName: '',
  wigleApiToken: '',
  homeLocation: EMPTY_HOME_LOCATION,
};

export const useConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [mapboxUnlimitedApiKey, setMapboxUnlimitedApiKey] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('');
  const [opencageApiKey, setOpencageApiKey] = useState('');
  const [geocodioApiKey, setGeocodioApiKey] = useState('');
  const [locationIqApiKey, setLocationIqApiKey] = useState('');
  const [smartyAuthId, setSmartyAuthId] = useState('');
  const [smartyAuthToken, setSmartyAuthToken] = useState('');
  const [mapboxConfigured, setMapboxConfigured] = useState(false);
  const [mapboxUnlimitedConfigured, setMapboxUnlimitedConfigured] = useState(false);
  const [googleMapsConfigured, setGoogleMapsConfigured] = useState(false);
  const [wigleConfigured, setWigleConfigured] = useState(false);
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [opencageConfigured, setOpencageConfigured] = useState(false);
  const [geocodioConfigured, setGeocodioConfigured] = useState(false);
  const [locationIqConfigured, setLocationIqConfigured] = useState(false);
  const [smartyConfigured, setSmartyConfigured] = useState(false);
  const [wigleApiName, setWigleApiName] = useState('');
  const [wigleApiToken, setWigleApiToken] = useState('');
  const [homeLocation, setHomeLocation] = useState<HomeLocationState>(EMPTY_HOME_LOCATION);
  const [savedValues, setSavedValues] = useState<SavedConfigurationValues>(EMPTY_SAVED_VALUES);
  const [homeLocationLoading, setHomeLocationLoading] = useState(true);
  const [homeLocationError, setHomeLocationError] = useState<string | null>(null);
  const [homeLocationConfigured, setHomeLocationConfigured] = useState(false);
  const [homeLocationLastUpdated, setHomeLocationLastUpdated] = useState<string | null>(null);

  const saveMapboxToken = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveMapboxToken(mapboxToken);
      setMapboxConfigured(true);
      setSavedValues((current) => ({ ...current, mapboxToken }));
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
      setSavedValues((current) => ({ ...current, mapboxUnlimitedApiKey }));
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
      setSavedValues((current) => ({
        ...current,
        wigleApiName,
        wigleApiToken,
      }));
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
      setSavedValues((current) => ({ ...current, googleMapsApiKey }));
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
      setSavedValues((current) => ({ ...current, awsRegion }));
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
      setSavedValues((current) => ({ ...current, opencageApiKey }));
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
      setSavedValues((current) => ({ ...current, locationIqApiKey }));
      alert('LocationIQ API key saved!');
    } catch (error) {
      alert(`Error saving LocationIQ key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGeocodioApiKey = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveGeocodioKey(geocodioApiKey);
      setGeocodioConfigured(true);
      setSavedValues((current) => ({ ...current, geocodioApiKey }));
      alert('Geocodio API key saved!');
    } catch (error) {
      alert(`Error saving Geocodio key: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSmartyCredentials = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveSmartyKey(smartyAuthId, smartyAuthToken);
      setSmartyConfigured(true);
      setSavedValues((current) => ({
        ...current,
        smartyAuthId,
        smartyAuthToken,
      }));
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
      setSavedValues((current) => ({
        ...current,
        homeLocation: {
          lat: String(lat),
          lng: String(lng),
          radius: String(radius),
        },
      }));
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
          geocodioRes,
          locationIqRes,
          smartyRes,
        ] = await Promise.all([
          adminApi.getMapboxToken(),
          adminApi.getMapboxUnlimited(),
          adminApi.getGoogleMapsKey(),
          adminApi.getWigleToken(),
          adminApi.getAwsSettings(),
          adminApi.getOpenCageKey(),
          adminApi.getGeocodioKey(),
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
          const savedToken = String(mapboxRes.value || '');
          setMapboxToken(savedToken);
          setSavedValues((current) => ({ ...current, mapboxToken: savedToken }));
        }
        if (mapboxUnlimitedRes) {
          setMapboxUnlimitedConfigured(Boolean(mapboxUnlimitedRes.configured));
          const savedApiKey = String(mapboxUnlimitedRes.value || '');
          setMapboxUnlimitedApiKey(savedApiKey);
          setSavedValues((current) => ({ ...current, mapboxUnlimitedApiKey: savedApiKey }));
        }
        if (googleRes) {
          setGoogleMapsConfigured(Boolean(googleRes.configured));
          const savedApiKey = String(googleRes.value || '');
          setGoogleMapsApiKey(savedApiKey);
          setSavedValues((current) => ({ ...current, googleMapsApiKey: savedApiKey }));
        }
        if (wigleRes) {
          setWigleConfigured(Boolean(wigleRes.configured));
          const savedApiName = String(wigleRes.apiName || '');
          const savedApiToken = String(wigleRes.apiToken || '');
          setWigleApiName(savedApiName);
          setWigleApiToken(savedApiToken);
          setSavedValues((current) => ({
            ...current,
            wigleApiName: savedApiName,
            wigleApiToken: savedApiToken,
          }));
        }
        if (awsRes) {
          setAwsConfigured(Boolean(awsRes.configured));
          const savedRegion = String(awsRes.region || '');
          setAwsRegion(savedRegion);
          setSavedValues((current) => ({ ...current, awsRegion: savedRegion }));
        }
        if (opencageRes) {
          setOpencageConfigured(Boolean(opencageRes.configured));
          const savedApiKey = String(opencageRes.value || '');
          setOpencageApiKey(savedApiKey);
          setSavedValues((current) => ({ ...current, opencageApiKey: savedApiKey }));
        }
        if (geocodioRes) {
          setGeocodioConfigured(Boolean(geocodioRes.configured));
          const savedApiKey = String(geocodioRes.value || '');
          setGeocodioApiKey(savedApiKey);
          setSavedValues((current) => ({ ...current, geocodioApiKey: savedApiKey }));
        }
        if (locationIqRes) {
          setLocationIqConfigured(Boolean(locationIqRes.configured));
          const savedApiKey = String(locationIqRes.value || '');
          setLocationIqApiKey(savedApiKey);
          setSavedValues((current) => ({ ...current, locationIqApiKey: savedApiKey }));
        }
        if (smartyRes) {
          setSmartyConfigured(Boolean(smartyRes.configured));
          const savedAuthId = String(smartyRes.authId || '');
          const savedAuthToken = String(smartyRes.authToken || '');
          setSmartyAuthId(savedAuthId);
          setSmartyAuthToken(savedAuthToken);
          setSavedValues((current) => ({
            ...current,
            smartyAuthId: savedAuthId,
            smartyAuthToken: savedAuthToken,
          }));
        }
      } catch {
        setMapboxConfigured(false);
        setMapboxUnlimitedConfigured(false);
        setGoogleMapsConfigured(false);
        setWigleConfigured(false);
        setAwsConfigured(false);
        setOpencageConfigured(false);
        setGeocodioConfigured(false);
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
          setSavedValues((current) => ({
            ...current,
            homeLocation: {
              lat: String(location.latitude),
              lng: String(location.longitude),
              radius: String(location.radius ?? 1000),
            },
          }));
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
    geocodioApiKey,
    setGeocodioApiKey,
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
    geocodioConfigured,
    locationIqConfigured,
    smartyConfigured,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    homeLocation,
    setHomeLocation,
    savedValues,
    homeLocationLoading,
    homeLocationError,
    homeLocationConfigured,
    homeLocationLastUpdated,
    saveMapboxToken,
    saveMapboxUnlimitedApiKey,
    saveGoogleMapsApiKey,
    saveAwsRegion,
    saveOpencageApiKey,
    saveGeocodioApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveWigleCredentials,
    saveHomeLocation,
  };
};
