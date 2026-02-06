import { useEffect, useState } from 'react';

export const useConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
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
      const response = await fetch('/api/settings/mapbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token: mapboxToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('Mapbox token saved!');
    } catch (error) {
      alert(`Error saving token: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWigleCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/wigle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ apiName: wigleApiName, apiToken: wigleApiToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('WiGLE credentials saved!');
    } catch (error) {
      alert(`Error saving credentials: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGoogleMapsApiKey = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/google-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ apiKey: googleMapsApiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('Google Maps API key saved!');
    } catch (error) {
      alert(`Error saving API key: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAwsCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/aws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          sessionToken: awsSessionToken || undefined,
          region: awsRegion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('AWS credentials saved!');
    } catch (error) {
      alert(`Error saving AWS credentials: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveOpencageApiKey = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/opencage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ apiKey: opencageApiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('OpenCage API key saved!');
    } catch (error) {
      alert(`Error saving OpenCage key: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLocationIqApiKey = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/locationiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ apiKey: locationIqApiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('LocationIQ API key saved!');
    } catch (error) {
      alert(`Error saving LocationIQ key: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSmartyCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/smarty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ authId: smartyAuthId, authToken: smartyAuthToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      alert('Smarty credentials saved!');
    } catch (error) {
      alert(`Error saving Smarty credentials: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHomeLocation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/home-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: parseFloat(homeLocation.lat),
          longitude: parseFloat(homeLocation.lng),
          radius: parseInt(homeLocation.radius),
        }),
      });
      alert(response.ok ? 'Home location saved!' : 'Failed to save location');
    } catch {
      alert('Error saving location');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadMaskedConfig = async () => {
      try {
        const [mapboxRes, googleRes, wigleRes, awsRes, opencageRes, locationIqRes, smartyRes] =
          await Promise.all([
            fetch('/api/settings/mapbox', { credentials: 'same-origin' }),
            fetch('/api/settings/google-maps', { credentials: 'same-origin' }),
            fetch('/api/settings/wigle', { credentials: 'same-origin' }),
            fetch('/api/settings/aws', { credentials: 'same-origin' }),
            fetch('/api/settings/opencage', { credentials: 'same-origin' }),
            fetch('/api/settings/locationiq', { credentials: 'same-origin' }),
            fetch('/api/settings/smarty', { credentials: 'same-origin' }),
          ]);

        if (mapboxRes.ok) {
          const data = await mapboxRes.json();
          const tokens = Array.isArray(data.tokens) ? data.tokens : [];
          setMapboxConfigured(tokens.length > 0);
        }
        if (googleRes.ok) {
          const data = await googleRes.json();
          setGoogleMapsConfigured(Boolean(data.configured));
        }
        if (wigleRes.ok) {
          const data = await wigleRes.json();
          setWigleConfigured(Boolean(data.configured));
        }
        if (awsRes.ok) {
          const data = await awsRes.json();
          setAwsConfigured(Boolean(data.configured));
          if (data.region && !awsRegion) {
            setAwsRegion(data.region);
          }
        }
        if (opencageRes.ok) {
          const data = await opencageRes.json();
          setOpencageConfigured(Boolean(data.configured));
        }
        if (locationIqRes.ok) {
          const data = await locationIqRes.json();
          setLocationIqConfigured(Boolean(data.configured));
        }
        if (smartyRes.ok) {
          const data = await smartyRes.json();
          setSmartyConfigured(Boolean(data.configured));
        }
      } catch {
        setMapboxConfigured(false);
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
    saveGoogleMapsApiKey,
    saveAwsCredentials,
    saveOpencageApiKey,
    saveLocationIqApiKey,
    saveSmartyCredentials,
    saveWigleCredentials,
    saveHomeLocation,
  };
};
