import { useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';

export const useConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [mapboxUnlimitedApiKey, setMapboxUnlimitedApiKey] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
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
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '', radius: '1000' });

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

  const saveAwsCredentials = async () => {
    try {
      setIsLoading(true);
      await adminApi.saveAwsCredentials(awsAccessKeyId, awsSecretAccessKey, awsRegion);
      setAwsConfigured(true);
      alert('AWS credentials saved!');
    } catch (error) {
      alert(`Error saving AWS credentials: ${(error as Error).message}`);
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
    try {
      setIsLoading(true);
      await adminApi.saveHomeLocation(
        parseFloat(homeLocation.lat),
        parseFloat(homeLocation.lng),
        parseInt(homeLocation.radius)
      );
      alert(true ? 'Home location saved!' : 'Failed to save location');
    } catch {
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
          adminApi.getAwsCredentials(),
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

    loadMaskedConfig();
  }, []);

  return {
    isLoading,
    mapboxToken,
    setMapboxToken,
    mapboxUnlimitedApiKey,
    setMapboxUnlimitedApiKey,
    googleMapsApiKey,
    setGoogleMapsApiKey,
    awsAccessKeyId,
    setAwsAccessKeyId,
    awsSecretAccessKey,
    setAwsSecretAccessKey,
    awsSessionToken,
    setAwsSessionToken,
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
    saveMapboxToken,
    saveMapboxUnlimitedApiKey,
    saveGoogleMapsApiKey,
    saveAwsCredentials,
    saveOpencageApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveWigleCredentials,
    saveHomeLocation,
  };
};
