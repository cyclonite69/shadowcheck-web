const express = require('express');
const router = express.Router();
const secretsManager = require('../../../services/secretsManager');

// GET / - Root redirect to index.html
router.get('/', (req, res) => {
  res.redirect('/index.html');
});

// GET /api/mapbox-token - Get Mapbox API token
router.get('/api/mapbox-token', (req, res) => {
  try {
    const token = secretsManager.get('mapbox_token');

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
