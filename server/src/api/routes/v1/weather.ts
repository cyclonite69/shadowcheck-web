/**
 * Weather API Proxy
 * Proxies requests to Open-Meteo API to avoid CSP issues
 */

import { Router } from 'express';

const router = Router();

router.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing lat/lon' });
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat as string);
    url.searchParams.set('longitude', lon as string);
    url.searchParams.set(
      'current',
      'precipitation,snowfall,cloud_cover,visibility,weather_code,is_day'
    );
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('[Weather Proxy]', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

module.exports = router;
