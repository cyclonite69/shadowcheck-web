/**
 * Unified Card Library
 * Reusable card components that can be added to any page
 */

const CardLibrary = {
  // Network List Card
  networkList: {
    id: 'network-list-card',
    title: '📡 Networks',
    defaultColumns: ['ssid', 'bssid', 'type', 'security', 'signal', 'lastSeen'],
    availableColumns: {
      ssid: { label: 'SSID', width: '150px' },
      bssid: { label: 'BSSID', width: '140px' },
      type: { label: 'Type', width: '60px' },
      security: { label: 'Security', width: '100px' },
      signal: { label: 'Signal', width: '80px' },
      channel: { label: 'Channel', width: '70px' },
      frequency: { label: 'Freq', width: '80px' },
      observations: { label: 'Obs', width: '60px' },
      lastSeen: { label: 'Last Seen', width: '150px' },
      latitude: { label: 'Lat', width: '90px' },
      longitude: { label: 'Lng', width: '90px' },
    },
    render: function (container, options = {}) {
      const columns = options.columns || this.defaultColumns;
      const filters = options.filters || {};

      container.innerHTML = `
                <div class="card-toolbar">
                    <button class="btn btn-sm" onclick="CardLibrary.networkList.openColumnPicker('${container.id}')">⚙️ Columns</button>
                    <button class="btn btn-sm" onclick="CardLibrary.networkList.refresh('${container.id}')">↻ Refresh</button>
                </div>
                <div class="table-container">
                    <table class="unified-table">
                        <thead>
                            <tr>${columns.map((col) => `<th>${this.availableColumns[col].label}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="${container.id}-tbody">
                            <tr><td colspan="${columns.length}" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;

      this.loadData(container.id, columns, filters);
    },
    loadData: async function (containerId, columns, filters) {
      try {
        const res = await fetch('/api/networks?page=1&limit=1000&sort=lastSeen&order=DESC');
        const data = await res.json();
        let networks = data.networks || [];

        // Apply filters
        if (filters.search) {
          const search = filters.search.toLowerCase();
          networks = networks.filter(
            (n) =>
              (n.ssid || '').toLowerCase().includes(search) ||
              (n.bssid || '').toLowerCase().includes(search)
          );
        }
        if (filters.type) networks = networks.filter((n) => n.type === filters.type);
        if (filters.security)
          networks = networks.filter((n) => (n.security || '').includes(filters.security));

        const tbody = document.getElementById(`${containerId}-tbody`);
        if (networks.length === 0) {
          tbody.innerHTML = `<tr><td colspan="${columns.length}" class="text-center text-secondary">No networks found</td></tr>`;
          return;
        }

        tbody.innerHTML = networks
          .map(
            (n) => `
                    <tr>
                        ${columns.map((col) => `<td>${this.formatCell(col, n[col], n)}</td>`).join('')}
                    </tr>
                `
          )
          .join('');
      } catch (err) {
        console.error('Error loading networks:', err);
      }
    },
    formatCell: function (column, value, row) {
      if (column === 'lastSeen') return value ? new Date(value).toLocaleString() : '-';
      if (column === 'signal') return value ? `${value} dBm` : '-';
      if (column === 'type') {
        const icons = { W: '📶', B: '🔷', E: '🔵', L: '📱', N: '🚀' };
        return icons[value] || value;
      }
      if (column === 'latitude' || column === 'longitude') return value ? value.toFixed(6) : '-';
      return value || '-';
    },
    openColumnPicker: function (containerId) {
      // TODO: Implement column picker modal
      alert('Column picker coming soon!');
    },
    refresh: function (containerId) {
      const container = document.getElementById(containerId);
      const columns = this.defaultColumns; // TODO: Get saved columns
      this.loadData(containerId, columns, {});
    },
  },

  // Threat List Card
  threatList: {
    id: 'threat-list-card',
    title: '⚠️ Threats',
    defaultColumns: ['severity', 'threatType', 'bssid', 'ssid', 'description', 'detected'],
    availableColumns: {
      severity: { label: 'Severity', width: '90px' },
      threatType: { label: 'Type', width: '120px' },
      bssid: { label: 'BSSID', width: '140px' },
      ssid: { label: 'SSID', width: '150px' },
      description: { label: 'Description', width: '250px' },
      detected: { label: 'Detected', width: '150px' },
    },
    render: function (container, options = {}) {
      const columns = options.columns || this.defaultColumns;

      container.innerHTML = `
                <div class="card-toolbar">
                    <button class="btn btn-sm" onclick="CardLibrary.threatList.refresh('${container.id}')">↻ Refresh</button>
                </div>
                <div class="table-container">
                    <table class="unified-table">
                        <thead>
                            <tr>${columns.map((col) => `<th>${this.availableColumns[col].label}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="${container.id}-tbody">
                            <tr><td colspan="${columns.length}" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            `;

      this.loadData(container.id, columns);
    },
    loadData: async function (containerId, columns) {
      try {
        const res = await fetch('/api/threats/quick?page=1&limit=1000');
        const data = await res.json();
        const threats = data.threats || [];

        const tbody = document.getElementById(`${containerId}-tbody`);
        if (threats.length === 0) {
          tbody.innerHTML = `<tr><td colspan="${columns.length}" class="text-center text-secondary">No threats detected</td></tr>`;
          return;
        }

        tbody.innerHTML = threats
          .map(
            (t) => `
                    <tr>
                        ${columns.map((col) => `<td>${this.formatCell(col, t)}</td>`).join('')}
                    </tr>
                `
          )
          .join('');
      } catch (err) {
        console.error('Error loading threats:', err);
      }
    },
    formatCell: function (column, threat) {
      if (column === 'severity') {
        const colors = { critical: '#dc2626', high: '#ea580c', medium: '#f59e0b', low: '#84cc16' };
        const severity = threat.severity || 'low';
        return `<span class="badge" style="background: ${colors[severity]}; color: white; padding: 4px 8px; border-radius: 4px;">${severity}</span>`;
      }
      if (column === 'threatType') return threat.threat_type || threat.threatType || '-';
      if (column === 'detected')
        return threat.detected_at ? new Date(threat.detected_at).toLocaleString() : '-';
      return threat[column] || '-';
    },
    refresh: function (containerId) {
      const columns = this.defaultColumns;
      this.loadData(containerId, columns);
    },
  },

  // Map Viewer Card
  mapViewer: {
    id: 'map-viewer-card',
    title: '🗺️ Map',
    render: function (container, options = {}) {
      container.innerHTML = `
                <div class="card-toolbar">
                    <button class="btn btn-sm" onclick="CardLibrary.mapViewer.refresh('${container.id}')">↻ Refresh</button>
                </div>
                <div id="${container.id}-map" style="width: 100%; height: 100%; min-height: 400px;"></div>
            `;

      this.initMap(container.id);
    },
    initMap: function (containerId) {
      // Map initialization will be done when Mapbox is available
      const mapDiv = document.getElementById(`${containerId}-map`);
      mapDiv.innerHTML =
        '<div class="text-center text-secondary" style="padding: 40px;">Map loading...</div>';
    },
    refresh: function (containerId) {
      this.initMap(containerId);
    },
  },
};

// Card Manager - handles adding cards to pages
class UnifiedCardManager {
  constructor() {
    this.activeCards = new Map();
    this.loadActiveCards();
  }

  loadActiveCards() {
    const saved = localStorage.getItem('shadowcheck_active_cards');
    if (saved) {
      const data = JSON.parse(saved);
      const page = window.location.pathname;
      this.activeCards = new Map(data[page] || []);
    }
  }

  saveActiveCards() {
    const saved = JSON.parse(localStorage.getItem('shadowcheck_active_cards') || '{}');
    const page = window.location.pathname;
    saved[page] = Array.from(this.activeCards.entries());
    localStorage.setItem('shadowcheck_active_cards', JSON.stringify(saved));
  }

  addCard(cardType, containerId) {
    const card = CardLibrary[cardType];
    if (!card) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    card.render(container);
    this.activeCards.set(containerId, cardType);
    this.saveActiveCards();
  }

  removeCard(containerId) {
    this.activeCards.delete(containerId);
    this.saveActiveCards();
    const container = document.getElementById(containerId);
    if (container) container.remove();
  }

  openCardLibrary() {
    // TODO: Show modal with available cards
    alert('Card library modal coming soon!');
  }
}

window.CardLibrary = CardLibrary;
window.cardManager = new UnifiedCardManager();
