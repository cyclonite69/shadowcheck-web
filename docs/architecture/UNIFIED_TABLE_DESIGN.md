# Unified Surveillance Table Design

## Current Problem

- 3 separate cards (Undetermined, Confirmed Threats, Tagged Safe)
- Items "move" between cards when tagged
- Confusing UX - where did my network go?
- Untag doesn't work properly

## Proposed Solution: ONE TABLE

### Single Table with Status Column

| SSID     | BSSID       | Threat Score | Status          | Locations | Days | Actions             |
| -------- | ----------- | ------------ | --------------- | --------- | ---- | ------------------- |
| T-Mobile | 31:02:60... | 90           | ⚪ UNDETERMINED | 12        | 9    | 🟢 Safe / 🔴 Threat |
| TP-LINK  | 18:D6:C7... | 75           | 🔴 THREAT       | 8         | 9    | ✕ Untag             |
| Verizon  | 31:14:80... | 75           | 🟢 SAFE         | 8         | 7    | ✕ Untag             |

### Benefits

1. **All threats visible** in one place
2. **Easy filtering** by status (dropdown or tabs)
3. **No confusion** - networks don't disappear
4. **Clear status** - see what you've tagged
5. **Easy untagging** - just click untag button

### Implementation

#### Backend (Already Works!)

```javascript
// API returns all threats with status
GET /api/threats/quick?page=1&limit=100
// Response includes:
{
  bssid: "...",
  threatScore: 90,
  userTag: "THREAT" | "FALSE_POSITIVE" | null,
  isTagged: true | false
}
```

#### Frontend Changes Needed

**Replace 3 cards with 1 table:**

```html
<div class="panel">
  <div class="panel-header">
    🔍 All Surveillance Threats
    <select id="status-filter">
      <option value="all">All (61)</option>
      <option value="undetermined">⚪ Undetermined (55)</option>
      <option value="threat">🔴 Threats (4)</option>
      <option value="safe">🟢 Safe (2)</option>
    </select>
  </div>

  <table class="threat-table">
    <thead>
      <tr>
        <th>SSID</th>
        <th>BSSID</th>
        <th>Score</th>
        <th>Status</th>
        <th>Locations</th>
        <th>Days</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="threat-table-body">
      <!-- Rows populated by JS -->
    </tbody>
  </table>
</div>
```

**Row rendering:**

```javascript
function renderThreatRow(threat) {
  const statusBadge =
    threat.userTag === 'THREAT'
      ? '🔴 THREAT'
      : threat.userTag === 'FALSE_POSITIVE'
        ? '🟢 SAFE'
        : '⚪ UNDETERMINED';

  const actions = threat.isTagged
    ? `<button onclick="untagNetwork('${threat.bssid}')">✕ Untag</button>`
    : `<button onclick="tagNetwork('${threat.bssid}', 'FALSE_POSITIVE')">🟢 Safe</button>
     <button onclick="tagNetwork('${threat.bssid}', 'THREAT')">🔴 Threat</button>`;

  return `
    <tr data-status="${threat.userTag || 'undetermined'}">
      <td>${threat.ssid || 'Hidden'}</td>
      <td class="mono">${threat.bssid}</td>
      <td><span class="threat-score-${getSeverityClass(threat.threatScore)}">${threat.threatScore}</span></td>
      <td>${statusBadge}</td>
      <td>${threat.uniqueLocations}</td>
      <td>${threat.uniqueDays}</td>
      <td>${actions}</td>
    </tr>
  `;
}
```

**Filtering:**

```javascript
document.getElementById('status-filter').addEventListener('change', (e) => {
  const filter = e.target.value;
  document.querySelectorAll('#threat-table-body tr').forEach((row) => {
    if (filter === 'all') {
      row.style.display = '';
    } else {
      const status = row.dataset.status;
      row.style.display =
        (filter === 'undetermined' && status === 'undetermined') ||
        (filter === 'threat' && status === 'THREAT') ||
        (filter === 'safe' && status === 'FALSE_POSITIVE')
          ? ''
          : 'none';
    }
  });
});
```

### Why This is Better

1. **No "movement"** - networks stay in place, just status changes
2. **Untag works** - just changes status back to undetermined
3. **All data visible** - no hidden cards
4. **Sortable** - click column headers to sort
5. **Filterable** - dropdown to show only what you want
6. **Searchable** - add search box to filter by SSID/BSSID

### Migration Path

1. Keep current 3-card layout as backup
2. Add new unified table below
3. Test with users
4. Remove old 3-card layout once confirmed working

## Why Only 61 Threats?

The algorithm requires:

- At least 2 observations
- Threat score >= 30
- Not cellular (unless >5km range)

Out of 117,687 networks:

- Most are stationary (seen in one place only)
- Most don't have home+away pattern
- 61 networks meet surveillance criteria

**This is correct!** The algorithm is working - it's finding the 61 networks that actually show surveillance patterns.

To get MORE threats, you would need to:

1. Lower threshold below 30 (but increases false positives)
2. Remove the "seen_at_home" requirement (but then it's just "any moving device")
3. Include single-location devices (but those aren't following you)

The current 61 are the legitimate surveillance candidates based on your criteria.
