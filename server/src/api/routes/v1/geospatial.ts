export {};
const express = require('express');
const router = express.Router();
const secretsManager = require('../../../services/secretsManager');
const keyringService = require('../../../services/keyringService');
const { Readable } = require('stream');
const { URL } = require('url');
const logger = require('../../../logging/logger');
const { withRetry } = require('../../../services/externalServiceHandler');
const { validateQuery, optional } = require('../../../validation/middleware');
const { validateString } = require('../../../validation/schemas');

const fetch = (...args: any[]) => {
  if (typeof (global as any).fetch !== 'function') {
    throw new Error('Fetch API is not available. Requires Node 20+ runtime.');
  }
  return (global as any).fetch(...args);
};

function pipeUpstreamBody(upstream, res) {
  if (!upstream.body) {
    res.end();
    return;
  }

  if (typeof upstream.body.pipe === 'function') {
    upstream.body.pipe(res);
    return;
  }

  Readable.fromWeb(upstream.body).pipe(res);
}

/**
 * Validates and normalizes a Mapbox style identifier.
 * @param {any} value - Raw style value
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateMapboxStyle(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: 'style must be a non-empty string' };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { valid: false, error: 'style must be a non-empty string' };
  }

  const normalized = raw.startsWith('mapbox://styles/') ? raw.replace('mapbox://styles/', '') : raw;

  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(normalized)) {
    return { valid: false, error: 'style must be in owner/style format' };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates Mapbox proxy URL input.
 * @param {any} value - Raw URL input
 * @returns {{ valid: boolean, error?: string, value?: string }}
 */
function validateMapboxProxyUrl(value) {
  const stringCheck = validateString(String(value || ''), 1, 2048, 'url');
  if (!stringCheck.valid) {
    return stringCheck;
  }

  return { valid: true, value: String(value).trim() };
}

/**
 * Validates geospatial query parameters.
 * @type {function}
 */
const validateMapboxStyleQuery = validateQuery({
  style: optional(validateMapboxStyle),
});

/**
 * Validates Mapbox proxy query parameters.
 * @type {function}
 */
const validateMapboxProxyQuery = validateQuery({
  url: validateMapboxProxyUrl,
});

/**
 * GET /api/mapbox-token - Get Mapbox API token
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
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

/**
 * GET /api/mapbox-style - Proxy Mapbox style JSON to validate token/connectivity
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
router.get('/api/mapbox-style', validateMapboxStyleQuery, async (req, res) => {
  try {
    const tokenRaw = secretsManager.get('mapbox_token');
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : null;
    if (!token) {
      return res
        .status(500)
        .json({ error: 'Mapbox token not configured', message: 'MAPBOX_TOKEN is missing' });
    }

    const styleId = req.validated?.style || 'mapbox/dark-v11';
    const url = `https://api.mapbox.com/styles/v1/${styleId}?access_token=${token}`;

    const resp = await withRetry(() => fetch(url), {
      serviceName: 'Mapbox style',
      timeoutMs: 10000,
      maxRetries: 2,
    });
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

/**
 * GET /api/mapbox-proxy?url=ENCODED - Proxy Mapbox requests to avoid client egress issues
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
router.get('/api/mapbox-proxy', validateMapboxProxyQuery, async (req, res) => {
  try {
    const rawUrl = req.validated?.url;
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

    const upstream = await withRetry(() => fetch(target.toString()), {
      serviceName: 'Mapbox proxy',
      timeoutMs: 10000,
      maxRetries: 1,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    pipeUpstreamBody(upstream, res);
  } catch (err) {
    logger.error(`Mapbox proxy error: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message || 'Mapbox proxy failed' });
  }
});

/**
 * GET /api/google-maps-token - Get Google Maps API key for client-side use
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
router.get('/api/google-maps-token', async (req, res) => {
  try {
    const apiKey =
      (await keyringService.getCredential('google_maps_api_key')) ||
      secretsManager.get('google_maps_api_key');
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

/**
 * GET /api/google-maps-tile/:type/:z/:x/:y - Proxy Google Maps tiles
 * Types: roadmap, satellite, hybrid, terrain
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
router.get('/api/google-maps-tile/:type/:z/:x/:y', async (req, res) => {
  try {
    const apiKey =
      (await keyringService.getCredential('google_maps_api_key')) ||
      secretsManager.get('google_maps_api_key');
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

    const response = await withRetry(() => fetch(tileUrl), {
      serviceName: 'Google Maps tile',
      timeoutMs: 10000,
      maxRetries: 1,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Google Maps] Upstream error ${response.status}: ${errorText}`);
      return res
        .status(response.status)
        .json({ error: 'Failed to fetch tile', details: errorText });
    }

    // Forward content type and cache headers
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    if (response.body && typeof response.body.pipe === 'function') {
      response.body.pipe(res);
    } else {
      Readable.fromWeb(response.body).pipe(res);
    }
  } catch (err) {
    logger.error(`Google Maps tile proxy error: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
