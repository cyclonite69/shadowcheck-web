const express = require('express');
const router = express.Router();
const secretsManager = require('../../../services/secretsManager');
const fetch = require('node-fetch');
const { URL } = require('url');
const logger = require('../../../logging/logger');

// GET /api/mapbox-token - Get Mapbox API token
router.get('/api/mapbox-token', (req, res) => {
  try {
    const tokenRaw = secretsManager.get('mapbox_token');
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : null;

    if (!token) {
      return res.status(500).json({
        error: 'Mapbox token not configured',
        message: 'MAPBOX_TOKEN is not available in secrets',
      });
    }

    res.json({
      token: token,
      ok: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mapbox-style - Proxy Mapbox style JSON to validate token/connectivity
router.get('/api/mapbox-style', async (req, res) => {
  try {
    const tokenRaw = secretsManager.get('mapbox_token');
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : null;
    if (!token) {
      return res
        .status(500)
        .json({ error: 'Mapbox token not configured', message: 'MAPBOX_TOKEN is missing' });
    }

    const styleIdRaw = req.query.style || 'mapbox/dark-v11';
    // Accept full mapbox://styles/... or bare namespace; normalize to owner/style
    const styleId = String(styleIdRaw).startsWith('mapbox://styles/')
      ? String(styleIdRaw).replace('mapbox://styles/', '')
      : String(styleIdRaw);
    const url = `https://api.mapbox.com/styles/v1/${styleId}?access_token=${token}`;

    const resp = await fetch(url);
    const bodyText = await resp.text();
    if (!resp.ok) {
      return res
        .status(resp.status)
        .json({ error: 'Mapbox style fetch failed', status: resp.status, body: bodyText });
    }

    let styleJson;
    try {
      styleJson = JSON.parse(bodyText);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from Mapbox style', body: bodyText });
    }

    res.json({ ok: true, style: styleJson });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch Mapbox style' });
  }
});

// GET /api/mapbox-proxy?url=ENCODED - Proxy Mapbox requests to avoid client egress issues
router.get('/api/mapbox-proxy', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) {
      return res.status(400).json({ error: 'url query param is required' });
    }

    let target;
    try {
      target = new URL(String(rawUrl));
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (target.hostname !== 'api.mapbox.com') {
      return res.status(400).json({ error: 'Only api.mapbox.com is allowed' });
    }

    const tokenRaw = secretsManager.get('mapbox_token');
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : null;
    if (!token) {
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }

    if (!target.searchParams.has('access_token')) {
      target.searchParams.set('access_token', token);
    }

    const upstream = await fetch(target.toString());

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    upstream.body.pipe(res);
  } catch (err) {
    logger.error(`Mapbox proxy error: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message || 'Mapbox proxy failed' });
  }
});

// GET /api/google-maps-token - Get Google Maps API key for client-side use
router.get('/api/google-maps-token', (req, res) => {
  try {
    const apiKey = secretsManager.get('google_maps_api_key');
    if (!apiKey) {
      return res.status(500).json({
        error: 'Google Maps API key not configured',
        ok: false,
      });
    }
    res.json({ apiKey, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message, ok: false });
  }
});

// GET /api/google-maps-tile/:type/:z/:x/:y - Proxy Google Maps tiles
// Types: roadmap, satellite, hybrid, terrain
router.get('/api/google-maps-tile/:type/:z/:x/:y', async (req, res) => {
  try {
    const apiKey = secretsManager.get('google_maps_api_key');
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const { type, z, x, y } = req.params;

    // Map type to Google's lyrs parameter
    const lyrsMap = {
      roadmap: 'm',
      satellite: 's',
      hybrid: 'y',
      terrain: 'p',
    };

    const lyrs = lyrsMap[type] || 'm';

    // Use Google's tile servers
    const server = Math.floor(Math.random() * 4); // mt0-mt3
    const tileUrl = `https://mt${server}.google.com/vt/lyrs=${lyrs}&x=${x}&y=${y}&z=${z}&key=${apiKey}`;

    const response = await fetch(tileUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch tile' });
    }

    // Forward content type and cache headers
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    response.body.pipe(res);
  } catch (err) {
    logger.error(`Google Maps tile proxy error: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
