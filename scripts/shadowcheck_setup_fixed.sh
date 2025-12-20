#!/bin/bash

# ShadowCheck Dashboard Setup Script
# One-shot installation of all dashboard components

set -e

echo "🚀 ShadowCheck Dashboard Setup"
echo "=============================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Check we're in the right directory
if [ ! -f "server.js" ]; then
  log_error "server.js not found. Please run this from the ShadowCheckStatic root directory"
fi

# Create directories if they don't exist
mkdir -p src/services src/repositories src/api/routes/v1

log_info "Creating dashboard service..."
cat > src/services/dashboardService.js << 'EOF'
const { query } = require('../config/database');

class DashboardService {
  constructor(networkRepository) {
    this.networkRepository = networkRepository;
  }

  async getMetrics() {
    try {
      const metrics = await this.networkRepository.getDashboardMetrics();
      return {
        ...metrics,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  async getThreats() {
    try {
      const networks = await this.networkRepository.getThreatenedNetworks();
      
      return networks
        .sort((a, b) => (b.threatScore || 0) - (a.threatScore || 0))
        .slice(0, 100)
        .map(n => ({
          bssid: n.bssid,
          ssid: n.ssid,
          threatScore: n.threatScore,
          threatLevel: n.threatLevel,
          type: n.type,
          signal: n.signal,
          observations: n.observations,
          lastSeen: n.lastSeen,
        }));
    } catch (error) {
      console.error('Error getting threats:', error);
      throw error;
    }
  }

  async getNetworkDistribution() {
    try {
      const metrics = await this.networkRepository.getDashboardMetrics();

      return {
        wifi: metrics.wifiCount,
        ble: metrics.bleCount,
        bluetooth: metrics.bluetoothCount,
        lte: metrics.lteCount,
        total: metrics.totalNetworks,
      };
    } catch (error) {
      console.error('Error getting network distribution:', error);
      throw error;
    }
  }
}

module.exports = DashboardService;
EOF
log_success "Created src/services/dashboardService.js"

log_info "Creating network repository..."
cat > src/repositories/networkRepository.js << 'EOF'
const { query } = require('../config/database');

class NetworkRepository {
  async getAllNetworks() {
    try {
      const result = await query(`
        SELECT 
          bssid,
          ssid,
          type,
          channel,
          signal,
          signal_dbm as signalDbm,
          max_signal as maxSignal,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          observations,
          total_observations as totalObservations,
          unique_days as uniqueDays,
          unique_locations as uniqueLocations,
          distance_range_km as distanceRangeKm,
          threat_score as threatScore,
          threat_level as threatLevel
        FROM app.networks
        ORDER BY observations DESC
        LIMIT 1000
      `);

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching networks:', error);
      return [];
    }
  }

  async getNetworksByType(type) {
    try {
      const result = await query(`
        SELECT 
          bssid,
          ssid,
          type,
          channel,
          signal,
          signal_dbm as signalDbm,
          max_signal as maxSignal,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          observations,
          threat_score as threatScore,
          threat_level as threatLevel
        FROM app.networks
        WHERE type = $1
        ORDER BY observations DESC
      `, [type]);

      return result.rows || [];
    } catch (error) {
      console.error(`Error fetching ${type} networks:`, error);
      return [];
    }
  }

  async getThreatenedNetworks() {
    try {
      const result = await query(`
        SELECT 
          bssid,
          ssid,
          type,
          channel,
          signal,
          signal_dbm as signalDbm,
          max_signal as maxSignal,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          observations,
          threat_score as threatScore,
          threat_level as threatLevel
        FROM app.networks
        WHERE threat_score >= 40
        ORDER BY threat_score DESC
      `);

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching threatened networks:', error);
      return [];
    }
  }

  async getDashboardMetrics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_networks,
          COUNT(*) FILTER (WHERE type = 'W') as wifi_count,
          COUNT(*) FILTER (WHERE type = 'E') as ble_count,
          COUNT(*) FILTER (WHERE type = 'B') as bluetooth_count,
          COUNT(*) FILTER (WHERE type = 'L') as lte_count,
          COUNT(*) FILTER (WHERE threat_score >= 80) as critical_threats,
          COUNT(*) FILTER (WHERE threat_score >= 60 AND threat_score < 80) as high_threats,
          COUNT(*) FILTER (WHERE threat_score >= 40 AND threat_score < 60) as medium_threats,
          COUNT(*) FILTER (WHERE threat_score < 40 AND threat_score > 0) as low_threats,
          COUNT(*) FILTER (WHERE observations >= 100) as active_surveillance,
          COUNT(*) FILTER (WHERE location IS NOT NULL) as enriched_count
        FROM app.networks
      `);

      const row = result.rows[0] || {};

      return {
        totalNetworks: parseInt(row.total_networks) || 0,
        wifiCount: parseInt(row.wifi_count) || 0,
        bleCount: parseInt(row.ble_count) || 0,
        bluetoothCount: parseInt(row.bluetooth_count) || 0,
        lteCount: parseInt(row.lte_count) || 0,
        threatsCritical: parseInt(row.critical_threats) || 0,
        threatsHigh: parseInt(row.high_threats) || 0,
        threatsMedium: parseInt(row.medium_threats) || 0,
        threatsLow: parseInt(row.low_threats) || 0,
        activeSurveillance: parseInt(row.active_surveillance) || 0,
        enrichedCount: parseInt(row.enriched_count) || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        totalNetworks: 0,
        wifiCount: 0,
        bleCount: 0,
        bluetoothCount: 0,
        lteCount: 0,
        threatsCritical: 0,
        threatsHigh: 0,
        threatsMedium: 0,
        threatsLow: 0,
        activeSurveillance: 0,
        enrichedCount: 0,
      };
    }
  }
}

module.exports = NetworkRepository;
EOF
log_success "Created src/repositories/networkRepository.js"

log_info "Creating dashboard routes..."
cat > src/api/routes/v1/dashboard.js << 'EOF'
const express = require('express');
const router = express.Router();

let dashboardService = null;

function initDashboardRoutes(options) {
  dashboardService = options.dashboardService;
}

// GET /api/v1/dashboard/metrics - Aggregated threat and network metrics
router.get('/dashboard/metrics', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }

    const metrics = await dashboardService.getMetrics();

    res.json({
      threats: {
        critical: metrics.threatsCritical || 0,
        high: metrics.threatsHigh || 0,
        medium: metrics.threatsMedium || 0,
        low: metrics.threatsLow || 0,
      },
      networks: {
        total: metrics.totalNetworks || 0,
        wifi: metrics.wifiCount || 0,
        ble: metrics.bleCount || 0,
        bluetooth: metrics.bluetoothCount || 0,
        lte: metrics.lteCount || 0,
      },
      surveillance: metrics.activeSurveillance || 0,
      enriched: metrics.enrichedCount || 0,
      timestamp: metrics.lastUpdated,
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/dashboard/threats - Detailed threat breakdown
router.get('/dashboard/threats', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }

    const threats = await dashboardService.getThreats();

    res.json({
      threats: threats || [],
      total: threats.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard threats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/dashboard/summary - Quick summary stats
router.get('/dashboard/summary', async (req, res) => {
  try {
    if (!dashboardService) {
      return res.status(500).json({ error: 'Dashboard service not initialized' });
    }

    const metrics = await dashboardService.getMetrics();
    const totalThreats = (metrics.threatsCritical || 0) + 
                         (metrics.threatsHigh || 0) + 
                         (metrics.threatsMedium || 0) + 
                         (metrics.threatsLow || 0);

    res.json({
      summary: {
        totalNetworks: metrics.totalNetworks || 0,
        totalThreats: totalThreats,
        criticalThreats: metrics.threatsCritical || 0,
        activeSurveillance: metrics.activeSurveillance || 0,
      },
      timestamp: metrics.lastUpdated,
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  initDashboardRoutes,
};
EOF
log_success "Created src/api/routes/v1/dashboard.js"

log_info "Verifying files..."
[ -f "src/services/dashboardService.js" ] && log_success "✓ dashboardService.js exists" || log_error "dashboardService.js not created"
[ -f "src/repositories/networkRepository.js" ] && log_success "✓ networkRepository.js exists" || log_error "networkRepository.js not created"
[ -f "src/api/routes/v1/dashboard.js" ] && log_success "✓ dashboard.js routes exist" || log_error "dashboard.js routes not created"

log_info "Checking line counts..."
echo "  dashboardService.js: $(wc -l < src/services/dashboardService.js) lines"
echo "  networkRepository.js: $(wc -l < src/repositories/networkRepository.js) lines"
echo "  dashboard.js: $(wc -l < src/api/routes/v1/dashboard.js) lines"

echo ""
echo "=============================="
log_success "Dashboard setup complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Update server.js route mounting section (around line 140-160)"
echo "2. Add these requires at the top of your route setup:"
echo ""
echo "    const NetworkRepository = require('./src/repositories/networkRepository');"
echo "    const DashboardService = require('./src/services/dashboardService');"
echo ""
echo "3. Initialize and mount:"
echo ""
echo "    const networkRepository = new NetworkRepository();"
echo "    const dashboardService = new DashboardService(networkRepository);"
echo "    const { router: dashboardRouter, initDashboardRoutes } = require('./src/api/routes/v1/dashboard');"
echo "    initDashboardRoutes({ dashboardService });"
echo "    app.use('/api', dashboardRouter);"
echo ""
echo "4. Restart and test:"
echo "    npm start"
echo "    curl http://localhost:3001/api/v1/dashboard/metrics"
echo ""