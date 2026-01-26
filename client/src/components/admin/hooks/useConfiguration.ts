import { useState } from 'react';

export const useConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [wigleApiName, setWigleApiName] = useState('');
  const [wigleApiToken, setWigleApiToken] = useState('');
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '', radius: '1000' });

  const saveMapboxToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/mapbox-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mapboxToken }),
      });
      alert(response.ok ? 'Mapbox token saved!' : 'Failed to save token');
    } catch {
      alert('Error saving token');
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
        body: JSON.stringify({ apiName: wigleApiName, apiToken: wigleApiToken }),
      });
      alert(response.ok ? 'WiGLE credentials saved!' : 'Failed to save credentials');
    } catch {
      alert('Error saving credentials');
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

  return {
    isLoading,
    mapboxToken,
    setMapboxToken,
    wigleApiName,
    setWigleApiName,
    wigleApiToken,
    setWigleApiToken,
    homeLocation,
    setHomeLocation,
    saveMapboxToken,
    saveWigleCredentials,
    saveHomeLocation,
  };
};
