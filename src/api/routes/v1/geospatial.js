const express = require('express');
const router = express.Router();
const secretsManager = require('../../../services/secretsManager');
const fetch = require('node-fetch');
const { URL } = require('url');

// GET / - Root redirect to index.html
router.get('/', (req, res) => {
  res.redirect('/index.html');
});

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

module.exports = router;

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
    console.error('Mapbox proxy error', err);
    res.status(500).json({ error: err.message || 'Mapbox proxy failed' });
  }
});
