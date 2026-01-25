const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');
const { validateQuery, optional } = require('../../../validation/middleware');
const {
  validateBSSIDList,
  validateBoundingBoxString,
  validateIntegerRange,
} = require('../../../validation/schemas');

// Middleware to require authentication (skip for admin panel)
const requireAuth = (req, res, next) => {
  // Skip auth check if request is from admin panel (has admin session)
  if (req.headers.referer && req.headers.referer.includes('/admin')) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validKey = secretsManager.get('api_key');
  if (!validKey || !apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * Validates optional KML export query parameters.
 * @type {function}
 */
const validateKmlQuery = validateQuery({
  bssids: optional((value) => validateBSSIDList(value, 5000)),
  limit: optional((value) => validateIntegerRange(value, 1, 10000, 'limit')),
  bbox: optional(validateBoundingBoxString),
});

// Export as GeoJSON
router.get('/geojson', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bssid,
        lat as latitude,
        lon as longitude,
        level as signal_dbm,
        time as observed_at,
        source_type,
        radio_type
      FROM public.observations
      ORDER BY time DESC
      LIMIT 10000
    `);

    const features = result.rows.map((row) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude],
      },
      properties: {
        bssid: row.bssid,
        signal_dbm: row.signal_dbm,
        observed_at: row.observed_at,
        source_type: row.source_type,
        radio_type: row.radio_type,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: features,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_export_${Date.now()}.geojson"`
    );
    res.json(geojson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as JSON
router.get('/json', requireAuth, async (req, res) => {
  try {
    const [observations, networks] = await Promise.all([
      query('SELECT * FROM public.observations ORDER BY time DESC LIMIT 10000'),
      query('SELECT * FROM public.networks LIMIT 10000'),
    ]);

    const data = {
      exported_at: new Date().toISOString(),
      observations: observations.rows,
      networks: networks.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_export_${Date.now()}.json"`
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as KML (for Google Earth)
router.get('/kml', validateKmlQuery, async (req, res) => {
  try {
    // Parse optional filters from query params
    const bssids = req.validated?.bssids;
    const limit = req.validated?.limit ?? 5000;
    const bbox = req.validated?.bbox;

    let whereClause = '';
    const params = [];

    if (bssids && bssids.length > 0) {
      params.push(bssids);
      whereClause = `WHERE o.bssid = ANY($${params.length})`;
    }

    if (bbox) {
      // bbox format: minLng,minLat,maxLng,maxLat
      const { minLng, minLat, maxLng, maxLat } = bbox;
      if (!whereClause) {
        whereClause = 'WHERE';
      } else {
        whereClause += ' AND';
      }
      params.push(minLng, minLat, maxLng, maxLat);
      whereClause += ` o.lon >= $${params.length - 3} AND o.lat >= $${params.length - 2} AND o.lon <= $${params.length - 1} AND o.lat <= $${params.length}`;
    }

    const result = await query(
      `
      SELECT
        o.bssid,
        o.lat AS latitude,
        o.lon AS longitude,
        o.level AS signal_dbm,
        o.time AS observed_at,
        o.radio_type,
        COALESCE(n.ssid, o.ssid, 'Unknown') AS ssid,
        COALESCE(n.type, o.radio_type, 'W') AS network_type
      FROM observations o
      LEFT JOIN networks n ON o.bssid = n.bssid
      ${whereClause}
      ORDER BY o.time DESC
      LIMIT $${params.length + 1}
    `,
      [...params, parseInt(limit)]
    );

    // Group observations by BSSID for better organization
    const networkGroups = {};
    result.rows.forEach((row) => {
      if (!networkGroups[row.bssid]) {
        networkGroups[row.bssid] = {
          ssid: row.ssid || 'Unknown',
          network_type: row.network_type || 'W',
          observations: [],
        };
      }
      networkGroups[row.bssid].observations.push(row);
    });

    // Generate KML
    const escapeXml = (str) => {
      if (!str) {
        return '';
      }
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const getNetworkTypeName = (type) => {
      const types = {
        W: 'WiFi',
        E: 'BLE',
        B: 'Bluetooth',
        L: 'LTE',
        N: '5G NR',
        G: 'GSM',
      };
      return types[type] || 'Unknown';
    };

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ShadowCheck Network Observations</name>
    <description>Exported network observations from ShadowCheck</description>

    <Style id="threatHigh">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
        <scale>1.2</scale>
      </IconStyle>
    </Style>
    <Style id="threatMedium">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon>
        <scale>1.0</scale>
      </IconStyle>
    </Style>
    <Style id="threatLow">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
        <scale>0.8</scale>
      </IconStyle>
    </Style>
    <Style id="bluetooth">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon>
        <scale>0.8</scale>
      </IconStyle>
    </Style>
`;

    // Get line color based on network type
    const getLineColor = (networkType) => {
      // KML colors are in AABBGGRR format
      const colors = {
        W: 'ff00ff00', // Green for WiFi
        E: 'ffff0000', // Blue for BLE
        B: 'ffff0000', // Blue for Bluetooth
        L: 'ff00ffff', // Yellow for LTE
        N: 'ff00ffff', // Yellow for 5G
        G: 'ff0080ff', // Orange for GSM
      };
      return colors[networkType] || 'ff00ff00';
    };

    // Add folders for each network
    for (const [bssid, network] of Object.entries(networkGroups)) {
      // Style based on network type
      const styleId =
        network.network_type === 'B' || network.network_type === 'E'
          ? 'bluetooth'
          : network.network_type === 'L' ||
              network.network_type === 'N' ||
              network.network_type === 'G'
            ? 'threatMedium'
            : 'threatLow';

      kml += `    <Folder>
      <name>${escapeXml(network.ssid)} (${escapeXml(bssid)})</name>
      <description>Type: ${getNetworkTypeName(network.network_type)}, Observations: ${network.observations.length}</description>
`;

      // Add each observation as a placemark
      network.observations.forEach((obs, idx) => {
        const timestamp = obs.observed_at ? new Date(obs.observed_at).toISOString() : '';
        kml += `      <Placemark>
        <name>${escapeXml(network.ssid)} #${idx + 1}</name>
        <description><![CDATA[
          <b>BSSID:</b> ${escapeXml(bssid)}<br/>
          <b>Signal:</b> ${obs.signal_dbm || 'N/A'} dBm<br/>
          <b>Observed:</b> ${timestamp}<br/>
          <b>Type:</b> ${getNetworkTypeName(network.network_type)}
        ]]></description>
        <styleUrl>#${styleId}</styleUrl>
        <Point>
          <coordinates>${obs.longitude},${obs.latitude},0</coordinates>
        </Point>
        ${timestamp ? `<TimeStamp><when>${timestamp}</when></TimeStamp>` : ''}
      </Placemark>
`;
      });

      // If network has multiple observations, add a LineString to show movement
      if (network.observations.length > 1) {
        const coords = network.observations.map((o) => `${o.longitude},${o.latitude},0`).join(' ');
        kml += `      <Placemark>
        <name>${escapeXml(network.ssid)} Path</name>
        <description>Movement path for ${escapeXml(bssid)}</description>
        <Style>
          <LineStyle>
            <color>${getLineColor(network.network_type)}</color>
            <width>2</width>
          </LineStyle>
        </Style>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coords}</coordinates>
        </LineString>
      </Placemark>
`;
      }

      kml += `    </Folder>
`;
    }

    kml += `  </Document>
</kml>`;

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_export_${Date.now()}.kml"`
    );
    res.send(kml);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as CSV
router.get('/csv', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bssid,
        lat as latitude,
        lon as longitude,
        level as signal_dbm,
        time as observed_at,
        source_type,
        radio_type
      FROM public.observations
      ORDER BY time DESC
      LIMIT 10000
    `);

    const headers = [
      'bssid',
      'latitude',
      'longitude',
      'signal_dbm',
      'observed_at',
      'source_type',
      'radio_type',
    ];
    const csv = [
      headers.join(','),
      ...result.rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          })
          .join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_export_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
