# ShadowCheck Network Explorer - Enhancement Implementation Guide

**Implementation Date Started:** 2025-12-04
**Files Modified:** `public/networks.html`
**Status:** 🚧 Phase 1 Complete, Phase 2-5 Pending

---

## Overview

Comprehensive enhancement plan for Network Explorer page including UI cleanup, advanced filtering, multi-network selection with Mapbox integration, network tagging system, and ML algorithm integration.

---

## ✅ PHASE 1: UI CLEANUP (COMPLETE)

### 1.1 Removed Refresh Button

**Location:** Top-right corner header controls
**File:** `public/networks.html`

**Changes Made:**

- **Line 607:** Removed `<button id="refresh-btn">🔄 Refresh</button>`
- **Lines 1301-1305:** Removed refresh button event listener

**Result:** Cleaner UI; filters and search naturally trigger data refresh

---

### 1.2 Removed Redundant Instruction Text

**Location:** Panel header below navigation
**File:** `public/networks.html`

**Changes Made:**

- **Line 620:** Removed `<span style="font-size: 10px; color: #94a3b8; margin-left: 12px;">💡 Click headers to sort • Shift+Click for multi-column</span>`

**Reasoning:** Duplicate of hint text already shown in header (lines 597-599)

**Kept:** Header hint text `"💡 Ctrl+Click: Multi-select | Shift+Click: Range"` remains visible

**Result:** Less clutter, cleaner panel header

---

## 🚧 PHASE 2: ADVANCED FILTERING SYSTEM (TODO)

### 2.1 Filter Panel Architecture

**Proposed Location:** Left sidebar (collapsible) OR horizontal panel above table

**Design Specifications:**

#### HTML Structure

```html
<div class="filter-panel">
  <div class="filter-header">
    <span class="filter-title">🔍 Filters</span>
    <span class="filter-count-badge">3 Active</span>
    <button class="clear-filters-btn">Clear All</button>
  </div>

  <!-- Active Filter Chips -->
  <div class="active-filters" id="active-filters">
    <span class="filter-chip">WiFi <span class="remove-chip">✕</span></span>
    <span class="filter-chip">Strong <span class="remove-chip">✕</span></span>
    <span class="filter-chip">WPA2-P <span class="remove-chip">✕</span></span>
  </div>

  <!-- Filter Sections -->
  <div class="filter-section">
    <div class="filter-section-header">Radio Type</div>
    <div class="filter-options">
      <!-- Radio Type Checkboxes -->
    </div>
  </div>

  <div class="filter-section">
    <div class="filter-section-header">Signal Strength</div>
    <div class="filter-options">
      <!-- Signal Strength Radio Buttons -->
    </div>
  </div>

  <!-- More filter sections... -->
</div>
```

#### CSS Styling

```css
.filter-panel {
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.filter-title {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}

.filter-count-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.filter-section {
  margin-bottom: 16px;
}

.filter-section-header {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  margin-right: 6px;
  margin-bottom: 6px;
}

.remove-chip {
  cursor: pointer;
  font-weight: bold;
  transition: color 0.2s;
}

.remove-chip:hover {
  color: #ef4444;
}
```

---

### 2.2 Radio Type Filter (Multi-Select Checkboxes)

**Implementation:**

```html
<div class="filter-section">
  <div class="filter-section-header">Radio Type</div>
  <div class="filter-options">
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="W" checked />
      <span class="filter-label">📶 WiFi</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="E" checked />
      <span class="filter-label">🔵 BLE</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="B" checked />
      <span class="filter-label">🔷 Bluetooth</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="L" checked />
      <span class="filter-label">📱 LTE</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="N" checked />
      <span class="filter-label">🚀 5G NR</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="radio-type" value="G" checked />
      <span class="filter-label">📞 GSM</span>
    </label>
  </div>
</div>
```

**JavaScript Logic:**

```javascript
const radioTypeFilter = {
  selectedTypes: new Set(['W', 'E', 'B', 'L', 'N', 'G']), // All selected by default

  init() {
    document.querySelectorAll('input[name="radio-type"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedTypes.add(e.target.value);
        } else {
          this.selectedTypes.delete(e.target.value);
        }
        this.apply();
      });
    });
  },

  apply() {
    if (window.networkTable) {
      networkTable.applyRadioTypeFilter(Array.from(this.selectedTypes));
      renderNetworkTable();
      updateFilterBadge();
    }
  },

  reset() {
    this.selectedTypes = new Set(['W', 'E', 'B', 'L', 'N', 'G']);
    document.querySelectorAll('input[name="radio-type"]').forEach((cb) => (cb.checked = true));
  },
};
```

---

### 2.3 Signal Strength Filter (Radio Buttons with Visual Bars)

**Implementation:**

```html
<div class="filter-section">
  <div class="filter-section-header">Signal Strength</div>
  <div class="filter-options">
    <label class="filter-radio">
      <input type="radio" name="signal-strength" value="all" checked />
      <span class="filter-label">All Strengths</span>
    </label>
    <label class="filter-radio">
      <input type="radio" name="signal-strength" value="strong" />
      <span class="filter-label">
        <span>Strong (> -50 dBm)</span>
        <div class="signal-bar">
          <div class="signal-bar-fill" style="width: 80%; background: #22C55E;"></div>
        </div>
      </span>
    </label>
    <label class="filter-radio">
      <input type="radio" name="signal-strength" value="good" />
      <span class="filter-label">
        <span>Good (-50 to -70 dBm)</span>
        <div class="signal-bar">
          <div class="signal-bar-fill" style="width: 60%; background: #FBBF24;"></div>
        </div>
      </span>
    </label>
    <label class="filter-radio">
      <input type="radio" name="signal-strength" value="weak" />
      <span class="filter-label">
        <span>Weak (-70 to -85 dBm)</span>
        <div class="signal-bar">
          <div class="signal-bar-fill" style="width: 30%; background: #F97316;"></div>
        </div>
      </span>
    </label>
    <label class="filter-radio">
      <input type="radio" name="signal-strength" value="very-weak" />
      <span class="filter-label">
        <span>Very Weak (< -85 dBm)</span>
        <div class="signal-bar">
          <div class="signal-bar-fill" style="width: 10%; background: #EF4444;"></div>
        </div>
      </span>
    </label>
  </div>
</div>
```

**CSS for Signal Bars:**

```css
.signal-bar {
  height: 6px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}

.signal-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}
```

**JavaScript Logic:**

```javascript
const signalStrengthFilter = {
  ranges: {
    all: { min: -120, max: 0 },
    strong: { min: -50, max: 0 },
    good: { min: -70, max: -50 },
    weak: { min: -85, max: -70 },
    'very-weak': { min: -120, max: -85 },
  },
  currentRange: 'all',

  init() {
    document.querySelectorAll('input[name="signal-strength"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.currentRange = e.target.value;
        this.apply();
      });
    });
  },

  apply() {
    const range = this.ranges[this.currentRange];
    if (window.networkTable) {
      networkTable.applySignalStrengthFilter(range.min, range.max);
      renderNetworkTable();
      updateFilterBadge();
    }
  },

  reset() {
    this.currentRange = 'all';
    document.querySelector('input[name="signal-strength"][value="all"]').checked = true;
  },
};
```

---

### 2.4 Security Type Filter (Multi-Select Checkboxes)

```html
<div class="filter-section">
  <div class="filter-section-header">Security Type</div>
  <div class="filter-options">
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="WPA2-P" checked />
      <span class="filter-label">🔒 WPA2-Personal</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="WPA2-E" checked />
      <span class="filter-label">🔐 WPA2-Enterprise</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="WPA3" checked />
      <span class="filter-label">🛡️ WPA3</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="WEP" checked />
      <span class="filter-label">⚠️ WEP</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="OPEN" checked />
      <span class="filter-label">🔓 Open</span>
    </label>
    <label class="filter-checkbox">
      <input type="checkbox" name="security-type" value="N/A" checked />
      <span class="filter-label">❓ N/A</span>
    </label>
  </div>
</div>
```

---

### 2.5 Filter Persistence (URL Query Params)

**Implementation:**

```javascript
const filterManager = {
  // Save filters to URL
  saveToURL() {
    const params = new URLSearchParams();

    // Radio types
    const radioTypes = Array.from(radioTypeFilter.selectedTypes);
    if (radioTypes.length < 6) {
      // Only save if not all selected
      params.set('type', radioTypes.join(','));
    }

    // Signal strength
    if (signalStrengthFilter.currentRange !== 'all') {
      params.set('signal', signalStrengthFilter.currentRange);
    }

    // Security types
    const securityTypes = Array.from(securityTypeFilter.selectedTypes);
    if (securityTypes.length < 6) {
      params.set('security', securityTypes.join(','));
    }

    // Update URL without reload
    const newURL = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  },

  // Load filters from URL on page load
  loadFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Radio types
    if (params.has('type')) {
      const types = params.get('type').split(',');
      radioTypeFilter.selectedTypes = new Set(types);
      // Update checkboxes
      document.querySelectorAll('input[name="radio-type"]').forEach((cb) => {
        cb.checked = types.includes(cb.value);
      });
    }

    // Signal strength
    if (params.has('signal')) {
      signalStrengthFilter.currentRange = params.get('signal');
      document.querySelector(
        `input[name="signal-strength"][value="${params.get('signal')}"]`
      ).checked = true;
    }

    // Security types
    if (params.has('security')) {
      const types = params.get('security').split(',');
      securityTypeFilter.selectedTypes = new Set(types);
      document.querySelectorAll('input[name="security-type"]').forEach((cb) => {
        cb.checked = types.includes(cb.value);
      });
    }

    // Apply all filters
    this.applyAllFilters();
  },

  applyAllFilters() {
    radioTypeFilter.apply();
    signalStrengthFilter.apply();
    securityTypeFilter.apply();
  },

  clearAll() {
    radioTypeFilter.reset();
    signalStrengthFilter.reset();
    securityTypeFilter.reset();
    this.applyAllFilters();
    window.history.replaceState({}, '', window.location.pathname);
  },
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  filterManager.loadFromURL();
});
```

---

## 🚧 PHASE 3: MULTI-NETWORK SELECTION & MAPBOX (TODO)

### 3.1 Selection Checkboxes

**Add Checkbox Column to Table:**

```html
<thead>
  <tr>
    <th style="width: 40px;">
      <input type="checkbox" id="select-all-checkbox" title="Select All" />
    </th>
    <th class="sortable" data-sort="ssid">SSID</th>
    <!-- Other headers... -->
  </tr>
</thead>
```

**CSS for Selected Rows:**

```css
.network-table tbody tr.selected {
  background: rgba(100, 150, 255, 0.1);
  border-left: 3px solid #3b82f6;
}

.network-table input[type='checkbox'] {
  cursor: pointer;
  width: 16px;
  height: 16px;
}
```

**JavaScript Selection Logic:**

```javascript
const selectionManager = {
  selectedNetworks: new Set(),

  init() {
    // Select All checkbox
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.network-checkbox');
      checkboxes.forEach((cb) => {
        cb.checked = e.target.checked;
        const networkId = cb.dataset.networkId;
        if (e.target.checked) {
          this.selectedNetworks.add(networkId);
        } else {
          this.selectedNetworks.delete(networkId);
        }
      });
      this.updateSelectionBadge();
      this.updateMapButton();
    });

    // Individual checkboxes
    document.querySelectorAll('.network-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const networkId = e.target.dataset.networkId;
        if (e.target.checked) {
          this.selectedNetworks.add(networkId);
        } else {
          this.selectedNetworks.delete(networkId);
        }
        this.updateSelectionBadge();
        this.updateMapButton();
      });
    });

    // Shift+Click range selection
    let lastCheckedIndex = null;
    document.querySelectorAll('.network-checkbox').forEach((checkbox, index) => {
      checkbox.addEventListener('click', (e) => {
        if (e.shiftKey && lastCheckedIndex !== null) {
          const start = Math.min(lastCheckedIndex, index);
          const end = Math.max(lastCheckedIndex, index);
          const checkboxes = document.querySelectorAll('.network-checkbox');
          for (let i = start; i <= end; i++) {
            checkboxes[i].checked = true;
            this.selectedNetworks.add(checkboxes[i].dataset.networkId);
          }
          this.updateSelectionBadge();
          this.updateMapButton();
        }
        lastCheckedIndex = index;
      });
    });
  },

  updateSelectionBadge() {
    const count = this.selectedNetworks.size;
    const badge = document.getElementById('selected-count');
    if (badge) {
      badge.textContent = count;
    }
  },

  updateMapButton() {
    const btn = document.getElementById('show-on-map-btn');
    if (this.selectedNetworks.size > 0) {
      btn.style.display = 'inline-block';
    } else {
      btn.style.display = 'none';
    }
  },

  clearSelection() {
    this.selectedNetworks.clear();
    document.querySelectorAll('.network-checkbox').forEach((cb) => (cb.checked = false));
    document.getElementById('select-all-checkbox').checked = false;
    this.updateSelectionBadge();
    this.updateMapButton();
  },
};
```

---

### 3.2 Mapbox Integration

**Initialize Mapbox:**

```javascript
let map;
let markers = [];

function initMapbox() {
  mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
  map = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-98.5795, 39.8283], // US center
    zoom: 4,
  });
}

function showSelectedOnMap() {
  const selectedNetworkIds = Array.from(selectionManager.selectedNetworks);
  const selectedNetworks = networkTable.networks.filter((n) => selectedNetworkIds.includes(n.id));

  // Clear existing markers
  markers.forEach((marker) => marker.remove());
  markers = [];

  // Add markers for selected networks
  const bounds = new mapboxgl.LngLatBounds();

  selectedNetworks.forEach((network) => {
    if (!network.latitude || !network.longitude) return;

    // Determine marker color based on tag status
    let markerColor = '#999999'; // Untagged (gray)
    if (network.tagStatus === 'safe') {
      markerColor = '#457B9D'; // Blue
    } else if (network.tagStatus === 'threat') {
      markerColor = '#E63946'; // Red
    }

    // Create marker
    const marker = new mapboxgl.Marker({ color: markerColor })
      .setLngLat([network.longitude, network.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <div style="padding: 8px;">
                        <strong>${network.ssid || 'Hidden'}</strong><br>
                        Signal: ${network.signal} dBm<br>
                        Last Seen: ${new Date(network.lastSeen).toLocaleString()}
                    </div>
                `)
      )
      .addTo(map);

    markers.push(marker);
    bounds.extend([network.longitude, network.latitude]);
  });

  // Zoom to fit all markers
  if (selectedNetworks.length > 0) {
    map.fitBounds(bounds, { padding: 50 });
  }

  // Open map panel (if separate tab/modal)
  document.getElementById('map-panel').style.display = 'block';
}
```

---

## 🚧 PHASE 4: NETWORK TAGGING SYSTEM (TODO)

### 4.1 Add Status Column to Table

**Update Table Header:**

```html
<th>Status</th>
<th>Actions</th>
```

**Render Status Cell:**

```javascript
function renderStatusCell(network) {
  if (network.tagStatus === 'safe') {
    return `<span class="status-badge status-safe">✓ Safe</span>`;
  } else if (network.tagStatus === 'threat') {
    return `<span class="status-badge status-threat">! Threat</span>`;
  } else {
    return `<span class="status-badge status-untagged">—</span>`;
  }
}
```

**CSS for Status Badges:**

```css
.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.status-safe {
  background: rgba(69, 123, 157, 0.2);
  color: #457b9d;
  border: 1px solid rgba(69, 123, 157, 0.4);
}

.status-threat {
  background: rgba(230, 57, 70, 0.2);
  color: #e63946;
  border: 1px solid rgba(230, 57, 70, 0.4);
}

.status-untagged {
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
```

---

### 4.2 Add Action Buttons

**Render Actions Cell:**

```javascript
function renderActionsCell(network) {
  return `
        <div class="action-buttons">
            <button class="tag-btn tag-safe" data-network-id="${network.id}" data-action="safe">
                ✓ Safe
            </button>
            <button class="tag-btn tag-threat" data-network-id="${network.id}" data-action="threat">
                ⚠ Threat
            </button>
            ${
              network.tagStatus !== 'untagged'
                ? `
                <button class="tag-btn tag-untag" data-network-id="${network.id}" data-action="untag">
                    ✕ Untag
                </button>
            `
                : ''
            }
        </div>
    `;
}
```

**CSS for Action Buttons:**

```css
.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}

.tag-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
  white-space: nowrap;
}

.tag-safe {
  background: rgba(69, 123, 157, 0.2);
  color: #457b9d;
  border-color: rgba(69, 123, 157, 0.4);
}

.tag-safe:hover {
  background: rgba(69, 123, 157, 0.3);
}

.tag-threat {
  background: rgba(230, 57, 70, 0.2);
  color: #e63946;
  border-color: rgba(230, 57, 70, 0.4);
}

.tag-threat:hover {
  background: rgba(230, 57, 70, 0.3);
}

.tag-untag {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.4);
}

.tag-untag:hover {
  background: rgba(148, 163, 184, 0.3);
}
```

---

### 4.3 Tag Network API Integration

**JavaScript Tagging Logic:**

```javascript
const tagManager = {
  async tagNetwork(networkId, status) {
    try {
      const response = await fetch('/api/networks/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId: networkId,
          status: status, // 'safe', 'threat', or 'untagged'
        }),
      });

      if (!response.ok) {
        throw new Error('Tag API failed');
      }

      const data = await response.json();

      if (data.success) {
        // Update local network object
        const network = networkTable.networks.find((n) => n.id === networkId);
        if (network) {
          network.tagStatus = status;
        }

        // Re-render table row
        this.updateNetworkRow(networkId, status);

        // Update map marker color if selected
        if (selectionManager.selectedNetworks.has(networkId)) {
          this.updateMarkerColor(networkId, status);
        }

        // Log to ML training queue
        if (status !== 'untagged') {
          await this.logToMLQueue(network, status);
        }

        console.log(`✓ Network ${networkId} tagged as ${status}`);
        return true;
      }
    } catch (err) {
      console.error('✗ Error tagging network:', err);
      alert(`Failed to tag network: ${err.message}`);
      return false;
    }
  },

  updateNetworkRow(networkId, status) {
    // Find table row and update status cell
    const row = document.querySelector(`tr[data-network-id="${networkId}"]`);
    if (row) {
      const statusCell = row.querySelector('.status-cell');
      const actionsCell = row.querySelector('.actions-cell');

      // Update status badge
      statusCell.innerHTML = renderStatusCell({ tagStatus: status });

      // Update action buttons (show/hide Untag)
      const network = networkTable.networks.find((n) => n.id === networkId);
      actionsCell.innerHTML = renderActionsCell(network);

      // Rebind event listeners
      this.bindActionButtons(actionsCell);
    }
  },

  updateMarkerColor(networkId, status) {
    const marker = markers.find((m) => m.networkId === networkId);
    if (marker) {
      let color = '#999999'; // untagged
      if (status === 'safe') color = '#457B9D';
      if (status === 'threat') color = '#E63946';

      // Update marker color (Mapbox API)
      marker.getElement().style.backgroundColor = color;
    }
  },

  bindActionButtons(container) {
    container.querySelectorAll('.tag-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const networkId = btn.dataset.networkId;
        const action = btn.dataset.action;

        btn.disabled = true;
        btn.style.opacity = '0.5';

        const success = await this.tagNetwork(networkId, action);

        if (!success) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });
    });
  },

  async logToMLQueue(network, label) {
    // Log tagged network for ML training
    try {
      await fetch('/api/ml/log-training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId: network.id,
          ssid: network.ssid,
          bssid: network.bssid,
          signalStrength: network.signal,
          securityType: network.security,
          frequency: network.frequency,
          latitude: network.latitude,
          longitude: network.longitude,
          observationCount: network.observations,
          label: label, // 'safe' or 'threat'
          timestamp: Date.now(),
        }),
      });
    } catch (err) {
      console.error('Failed to log ML training data:', err);
    }
  },
};

// Initialize tag buttons when table renders
function initTagButtons() {
  document.querySelectorAll('.action-buttons').forEach((container) => {
    tagManager.bindActionButtons(container);
  });
}
```

---

## 🚧 PHASE 5: ML ALGORITHM INTEGRATION (TODO)

### 5.1 Backend API Endpoints Required

**Tag Network Endpoint:**

```javascript
// POST /api/networks/tag
app.post('/api/networks/tag', async (req, res) => {
  const { networkId, status } = req.body;

  try {
    // Update network tag in database
    await pool.query(
      `
            UPDATE app.networks_legacy
            SET tag_status = $1,
                tagged_at = NOW()
            WHERE id = $2
        `,
      [status, networkId]
    );

    // Return updated network
    const result = await pool.query(
      `
            SELECT * FROM app.networks_legacy WHERE id = $1
        `,
      [networkId]
    );

    res.json({
      success: true,
      network: result.rows[0],
    });
  } catch (err) {
    console.error('Error tagging network:', err);
    res.status(500).json({ error: 'Failed to tag network' });
  }
});
```

**ML Training Data Logger:**

```javascript
// POST /api/ml/log-training-data
app.post('/api/ml/log-training-data', async (req, res) => {
  const trainingData = req.body;

  try {
    // Insert into ML training queue
    await pool.query(
      `
            INSERT INTO ml_training_queue (
                network_id, ssid, bssid, signal_strength,
                security_type, frequency, latitude, longitude,
                observation_count, label, logged_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `,
      [
        trainingData.networkId,
        trainingData.ssid,
        trainingData.bssid,
        trainingData.signalStrength,
        trainingData.securityType,
        trainingData.frequency,
        trainingData.latitude,
        trainingData.longitude,
        trainingData.observationCount,
        trainingData.label,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging ML data:', err);
    res.status(500).json({ error: 'Failed to log training data' });
  }
});
```

**ML Model Retraining Trigger:**

```javascript
// POST /api/ml/retrain (triggered after 50 new tags, or daily cron)
app.post('/api/ml/retrain', async (req, res) => {
  try {
    // Fetch training data
    const trainingData = await pool.query(`
            SELECT * FROM ml_training_queue
            WHERE processed = false
            ORDER BY logged_at DESC
        `);

    // Call ML training script (Python subprocess or ML API)
    const { spawn } = require('child_process');
    const mlProcess = spawn('python', ['scripts/ml/train_model.py']);

    mlProcess.stdout.on('data', (data) => {
      console.log(`ML Training: ${data}`);
    });

    mlProcess.on('close', (code) => {
      if (code === 0) {
        // Mark training data as processed
        pool.query(`
                    UPDATE ml_training_queue
                    SET processed = true
                    WHERE processed = false
                `);

        res.json({ success: true, message: 'Model retrained successfully' });
      } else {
        res.status(500).json({ error: 'ML training failed' });
      }
    });
  } catch (err) {
    console.error('Error retraining ML model:', err);
    res.status(500).json({ error: 'Failed to retrain model' });
  }
});
```

---

### 5.2 Database Schema Updates Required

**Add Tag Columns to Networks Table:**

```sql
ALTER TABLE app.networks_legacy
ADD COLUMN tag_status VARCHAR(20) DEFAULT 'untagged',
ADD COLUMN tagged_at TIMESTAMP,
ADD COLUMN tagged_by VARCHAR(100);

CREATE INDEX idx_tag_status ON app.networks_legacy(tag_status);
```

**Create ML Training Queue Table:**

```sql
CREATE TABLE ml_training_queue (
    id SERIAL PRIMARY KEY,
    network_id INTEGER REFERENCES app.networks_legacy(id),
    ssid TEXT,
    bssid TEXT,
    signal_strength INTEGER,
    security_type TEXT,
    frequency FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    observation_count INTEGER,
    label VARCHAR(20), -- 'safe' or 'threat'
    logged_at TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_processed ON ml_training_queue(processed);
CREATE INDEX idx_label ON ml_training_queue(label);
```

---

## Testing Checklist

### Phase 1 Testing ✅

- [x] Refresh button removed from header
- [x] Refresh button event listener removed
- [x] Redundant instruction text removed
- [x] Page still loads and functions correctly
- [x] Filters and search still trigger data refresh

### Phase 2 Testing (Pending)

- [ ] Filter panel displays correctly
- [ ] Radio Type checkboxes toggle correctly
- [ ] Signal Strength radio buttons change correctly
- [ ] Security Type checkboxes work
- [ ] Multiple filters apply with AND logic
- [ ] Filter chips display active filters
- [ ] Clear All Filters button resets everything
- [ ] Filters persist in URL query params
- [ ] Shared URL loads with correct filters applied

### Phase 3 Testing (Pending)

- [ ] Checkbox column appears in table
- [ ] Individual checkbox selection works
- [ ] Select All checkbox selects all visible networks
- [ ] Shift+Click range selection works
- [ ] Selection badge shows correct count
- [ ] "Show on Map" button appears when networks selected
- [ ] Mapbox renders selected networks
- [ ] Markers have correct colors (gray/blue/red)
- [ ] Marker popups show network details
- [ ] Zoom to fit works correctly

### Phase 4 Testing (Pending)

- [ ] Status column displays correct badges
- [ ] Action buttons render correctly
- [ ] Tag as Safe works, updates status and map color
- [ ] Tag as Threat works, updates status and map color
- [ ] Untag button appears after tagging
- [ ] Untag works, resets to untagged state
- [ ] Tagging syncs with Surveillance page
- [ ] ML training data logged successfully

### Phase 5 Testing (Pending)

- [ ] ML training queue populates correctly
- [ ] Model retraining completes without errors
- [ ] Threat predictions update after retraining
- [ ] Model accuracy improves with more tags

---

## Implementation Priority Recommendations

### Week 1 (Critical MVP)

1. ✅ UI Cleanup (Complete)
2. ⏳ Filter Panel Structure + Radio Type Filter
3. ⏳ Signal Strength Filter
4. ⏳ Multi-select checkboxes in table

### Week 2 (High Value Features)

5. Security Type Filter
6. Status column + Tag action buttons
7. Tag API integration
8. Basic Mapbox integration for selected networks

### Week 3 (Advanced Features)

9. Filter persistence in URL
10. Filter chips display
11. Surveillance page sync
12. Mapbox marker popups and zoom

### Week 4 (ML Integration)

13. ML training data logging
14. Database schema updates
15. ML retraining trigger
16. Model prediction updates

---

## Color Reference

- **Safe Blue:** `#457B9D` / rgba(69, 123, 157, 0.2)
- **Threat Red:** `#E63946` / rgba(230, 57, 70, 0.2)
- **Untagged Gray:** `#999999` / rgba(153, 153, 153, 0.2)
- **Strong Signal:** `#22C55E` (Green)
- **Good Signal:** `#FBBF24` (Yellow)
- **Weak Signal:** `#F97316` (Orange)
- **Very Weak Signal:** `#EF4444` (Red)
- **Selection Highlight:** rgba(100, 150, 255, 0.1)

---

## Files Modified

**Current:**

- `public/networks.html` - UI cleanup (refresh button, instruction text removed)

**Pending:**

- `public/networks.html` - Filter panel, selection, tagging UI
- `server.js` - Tag API endpoints, ML endpoints
- Database schema - Add tag columns, ML training queue table

---

## Status Summary

✅ **Complete:** UI Cleanup (Phase 1)
🚧 **In Progress:** Documentation and planning
⏳ **Pending:** Phases 2-5 implementation

**Next Steps:** Implement filter panel structure and Radio Type filter as first step of Phase 2.

---

**Documentation Version:** 1.0
**Last Updated:** 2025-12-04
**Status:** Planning Complete, Implementation Phases 2-5 Pending
