/**
 * OUI Routes
 * Handles OUI grouping and MAC randomization analysis
 */

export {};

const express = require('express');
const router = express.Router();
const {
  adminDbService,
  ouiGroupingService: OUIGroupingService,
} = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/admin/oui/groups
 * Get all OUI device groups with collective threat scores
 */
router.get('/admin/oui/groups', async (req, res) => {
  try {
    const groups = await adminDbService.getOUIGroups();

    res.json({
      ok: true,
      groups,
      count: groups.length,
    });
  } catch (err) {
    logger.error('Failed to get OUI groups:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI groups' });
  }
});

/**
 * GET /api/admin/oui/:oui/details
 * Get detailed info for specific OUI group
 */
router.get('/admin/oui/:oui/details', async (req, res) => {
  try {
    const { oui } = req.params;

    const { group, randomization, networks } = await adminDbService.getOUIGroupDetails(oui);

    res.json({
      ok: true,
      group,
      randomization,
      networks,
    });
  } catch (err) {
    logger.error('Failed to get OUI details:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI details' });
  }
});

/**
 * GET /api/admin/oui/randomization/suspects
 * Get all suspected MAC randomization devices
 */
router.get('/admin/oui/randomization/suspects', async (req, res) => {
  try {
    const suspects = await adminDbService.getMACRandomizationSuspects();

    res.json({
      ok: true,
      suspects,
      count: suspects.length,
    });
  } catch (err) {
    logger.error('Failed to get randomization suspects:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch suspects' });
  }
});

/**
 * POST /api/admin/oui/analyze
 * Trigger OUI grouping and MAC randomization analysis
 */
router.post('/admin/oui/analyze', async (req, res) => {
  try {
    logger.info('[Admin] Starting OUI analysis...');
    await OUIGroupingService.generateOUIGroups();
    await OUIGroupingService.detectMACRandomization();

    res.json({
      ok: true,
      message: 'OUI analysis completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('OUI analysis failed:', err);
    res.status(500).json({ ok: false, error: 'OUI analysis failed' });
  }
});

/**
 * GET /api/admin/demo/oui-grouping - Serve OUI grouping demo page
 */
router.get('/admin/demo/oui-grouping', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🛡️ ShadowCheck: OUI Grouping + MAC Spoofing Detection</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #2c3e50; text-align: center; }
        .section { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { flex: 1; background: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.critical { background: #e74c3c; }
        .stat-card.high { background: #f39c12; }
        .stat-card.medium { background: #f1c40f; color: #2c3e50; }
        .stat-number { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #34495e; color: white; }
        .threat-critical { background: #ffebee; color: #c62828; font-weight: bold; }
        .threat-high { background: #fff3e0; color: #ef6c00; font-weight: bold; }
        .threat-med { background: #fffde7; color: #f57f17; font-weight: bold; }
        .threat-low { background: #f3e5f5; color: #7b1fa2; }
        .oui { font-family: monospace; font-weight: bold; color: #2980b9; }
        .bssid { font-family: monospace; font-size: 0.9em; color: #7f8c8d; }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .loading { text-align: center; padding: 40px; color: #7f8c8d; }
        .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .success { background: #e8f5e8; color: #2e7d32; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .device-count { background: #ecf0f1; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ ShadowCheck: OUI Grouping + MAC Spoofing Detection</h1>

        <div class="section">
            <h2>📊 Detection Overview</h2>
            <p><strong>OUI Grouping</strong> detects multiple BSSIDs from the same physical device (multi-radio devices).</p>
            <p><strong>MAC Randomization</strong> identifies devices that change their MAC addresses over time for privacy.</p>

            <div class="stats" id="stats">
                <div class="stat-card">
                    <div class="stat-number" id="totalGroups">-</div>
                    <div class="stat-label">OUI Groups</div>
                </div>
                <div class="stat-card critical">
                    <div class="stat-number" id="criticalGroups">-</div>
                    <div class="stat-label">Critical Threats</div>
                </div>
                <div class="stat-card high">
                    <div class="stat-number" id="highGroups">-</div>
                    <div class="stat-label">High Threats</div>
                </div>
                <div class="stat-card medium">
                    <div class="stat-number" id="randomizationSuspects">-</div>
                    <div class="stat-label">MAC Randomization</div>
                </div>
            </div>

            <button class="btn btn-primary" onclick="runAnalysis()">🔄 Run OUI Analysis</button>
            <button class="btn btn-success" onclick="loadData()">📊 Refresh Data</button>
        </div>

        <div class="section">
            <h2>🎯 Top OUI Device Groups</h2>
            <div id="ouiGroupsLoading" class="loading">Loading OUI groups...</div>
            <div id="ouiGroupsError" class="error" style="display: none;"></div>
            <table id="ouiGroupsTable" style="display: none;">
                <thead>
                    <tr>
                        <th>OUI</th>
                        <th>Device Count</th>
                        <th>Collective Threat</th>
                        <th>Threat Level</th>
                        <th>Primary BSSID</th>
                        <th>Secondary BSSIDs (Sample)</th>
                    </tr>
                </thead>
                <tbody id="ouiGroupsBody"></tbody>
            </table>
        </div>

        <div class="section">
            <h2>🚶 MAC Randomization Suspects</h2>
            <div id="randomizationLoading" class="loading">Loading MAC randomization suspects...</div>
            <div id="randomizationError" class="error" style="display: none;"></div>
            <table id="randomizationTable" style="display: none;">
                <thead>
                    <tr>
                        <th>OUI</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>MAC Count</th>
                        <th>Avg Distance</th>
                        <th>Movement Speed</th>
                        <th>Detected</th>
                    </tr>
                </thead>
                <tbody id="randomizationBody"></tbody>
            </table>
            <div id="noRandomization" style="display: none;">
                <p>✅ No MAC randomization suspects detected. This could mean:</p>
                <ul>
                    <li>No devices are using MAC randomization in your dataset</li>
                    <li>Detection thresholds are too strict</li>
                    <li>Insufficient temporal data for pattern detection</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        let ouiGroups = [];
        let randomizationSuspects = [];

        async function runAnalysis() {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = '🔄 Running Analysis...';

            try {
                const response = await fetch('/api/admin/oui/analyze', { method: 'POST' });
                const data = await response.json();

                if (data.ok) {
                    document.getElementById('ouiGroupsError').style.display = 'none';
                    const success = document.createElement('div');
                    success.className = 'success';
                    success.textContent = '✅ OUI analysis completed successfully!';
                    btn.parentNode.appendChild(success);
                    setTimeout(() => success.remove(), 3000);

                    // Refresh data
                    await loadData();
                } else {
                    throw new Error(data.error || 'Analysis failed');
                }
            } catch (error) {
                const errorDiv = document.getElementById('ouiGroupsError');
                errorDiv.textContent = \`❌ Analysis failed: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.textContent = '🔄 Run OUI Analysis';
            }
        }

        async function loadData() {
            await Promise.all([loadOUIGroups(), loadRandomizationSuspects()]);
            updateStats();
        }

        async function loadOUIGroups() {
            try {
                document.getElementById('ouiGroupsLoading').style.display = 'block';
                document.getElementById('ouiGroupsTable').style.display = 'none';

                const response = await fetch('/api/admin/oui/groups');
                const data = await response.json();

                if (data.ok) {
                    ouiGroups = data.groups;
                    renderOUIGroups();
                    document.getElementById('ouiGroupsError').style.display = 'none';
                } else {
                    throw new Error(data.error || 'Failed to load OUI groups');
                }
            } catch (error) {
                const errorDiv = document.getElementById('ouiGroupsError');
                errorDiv.textContent = \`❌ Failed to load OUI groups: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                document.getElementById('ouiGroupsLoading').style.display = 'none';
            }
        }

        async function loadRandomizationSuspects() {
            try {
                document.getElementById('randomizationLoading').style.display = 'block';
                document.getElementById('randomizationTable').style.display = 'none';
                document.getElementById('noRandomization').style.display = 'none';

                const response = await fetch('/api/admin/oui/randomization/suspects');
                const data = await response.json();

                if (data.ok) {
                    randomizationSuspects = data.suspects;
                    if (randomizationSuspects.length > 0) {
                        renderRandomizationSuspects();
                    } else {
                        document.getElementById('noRandomization').style.display = 'block';
                    }
                    document.getElementById('randomizationError').style.display = 'none';
                } else {
                    throw new Error(data.error || 'Failed to load randomization suspects');
                }
            } catch (error) {
                const errorDiv = document.getElementById('randomizationError');
                errorDiv.textContent = \`❌ Failed to load randomization suspects: \${error.message}\`;
                errorDiv.style.display = 'block';
            } finally {
                document.getElementById('randomizationLoading').style.display = 'none';
            }
        }

        function renderOUIGroups() {
            const tbody = document.getElementById('ouiGroupsBody');
            tbody.innerHTML = '';

            // Show top 20 groups
            const topGroups = ouiGroups.slice(0, 20);

            topGroups.forEach(group => {
                const row = document.createElement('tr');

                const threatClass = group.threat_level.toLowerCase().replace('critical', 'critical');
                row.className = \`threat-\${threatClass}\`;

                const secondaryBssids = group.secondary_bssids || [];
                const sampleSecondary = secondaryBssids.slice(0, 3).join(', ');
                const moreCount = secondaryBssids.length > 3 ? \` (+\${secondaryBssids.length - 3} more)\` : '';

                row.innerHTML = \`
                    <td class="oui">\${group.oui}</td>
                    <td><span class="device-count">\${group.device_count}</span></td>
                    <td>\${parseFloat(group.collective_threat_score).toFixed(1)}</td>
                    <td>\${group.threat_level}</td>
                    <td class="bssid">\${group.primary_bssid}</td>
                    <td class="bssid">\${sampleSecondary}\${moreCount}</td>
                \`;

                tbody.appendChild(row);
            });

            document.getElementById('ouiGroupsTable').style.display = 'table';
        }

        function renderRandomizationSuspects() {
            const tbody = document.getElementById('randomizationBody');
            tbody.innerHTML = '';

            randomizationSuspects.forEach(suspect => {
                const row = document.createElement('tr');

                const confidenceClass = parseFloat(suspect.confidence_score) >= 0.8 ? 'threat-critical' :
                                       parseFloat(suspect.confidence_score) >= 0.6 ? 'threat-high' : 'threat-med';
                row.className = confidenceClass;

                row.innerHTML = \`
                    <td class="oui">\${suspect.oui}</td>
                    <td>\${suspect.status.toUpperCase()}</td>
                    <td>\${(parseFloat(suspect.confidence_score) * 100).toFixed(1)}%</td>
                    <td>\${suspect.mac_count}</td>
                    <td>\${parseFloat(suspect.avg_distance_km).toFixed(1)} km</td>
                    <td>\${parseFloat(suspect.movement_speed_kmh).toFixed(1)} km/h</td>
                    <td>\${new Date(suspect.created_at).toLocaleDateString()}</td>
                \`;

                tbody.appendChild(row);
            });

            document.getElementById('randomizationTable').style.display = 'table';
        }

        function updateStats() {
            document.getElementById('totalGroups').textContent = ouiGroups.length;

            const critical = ouiGroups.filter(g => g.threat_level === 'CRITICAL').length;
            const high = ouiGroups.filter(g => g.threat_level === 'HIGH').length;

            document.getElementById('criticalGroups').textContent = critical;
            document.getElementById('highGroups').textContent = high;
            document.getElementById('randomizationSuspects').textContent = randomizationSuspects.length;
        }

        // Load data on page load
        window.addEventListener('load', loadData);
    </script>
</body>
</html>
  `);
});

module.exports = router;
