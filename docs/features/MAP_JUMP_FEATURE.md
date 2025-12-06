# Map Jump Functionality

## Features Implemented

### 1. Double-Click to Jump to Map ✅
**Networks Page → Geospatial Page**

- Double-click any network row in the networks table
- Automatically jumps to geospatial page
- Map flies to network location (zoom level 16)
- Popup shows network details

**Requirements**:
- Network must have latitude/longitude data
- If no location data, shows alert message

### 2. Multi-Select and Jump to Map ✅
**Networks Page → Geospatial Page**

- Checkbox column added to networks table
- "Select All" checkbox in header
- "📍 Jump to Map (N)" button shows selected count
- Button disabled when no networks selected
- Click button to jump to map with all selected networks

**Map Behavior**:
- Fits bounds to show all selected networks
- Adds popup for each selected network
- 100px padding around bounds

### 3. Selection Counter ✅
- Shows count of selected networks: "📍 Jump to Map (3)"
- Updates in real-time as checkboxes change
- Button disabled when count is 0

## How to Use

### Double-Click Single Network
1. Go to Networks page
2. Find a network with location data
3. Double-click the row
4. Map opens and flies to that network

### Select Multiple Networks
1. Go to Networks page
2. Check boxes next to networks you want to view
3. Or click "Select All" checkbox in header
4. Click "📍 Jump to Map (N)" button
5. Map opens showing all selected networks

## Technical Implementation

### Networks Page Changes

**Table Structure**:
```html
<th><input type="checkbox" id="select-all"></th>
<!-- Checkbox column added as first column -->
```

**Row Data Attributes**:
```javascript
tr.dataset.bssid = network.bssid;
tr.dataset.lat = network.latitude;
tr.dataset.lng = network.longitude;
```

**Functions Added**:
- `jumpToMapSelected()` - Jump with selected networks
- `jumpToMapSingle(bssid, lat, lng)` - Jump to single network
- `updateSelectionCount()` - Update button text and state

**Event Handlers**:
- Double-click on tbody → `jumpToMapSingle()`
- Checkbox change → `updateSelectionCount()`
- Select all checkbox → Toggle all checkboxes

### Geospatial Page Changes

**URL Parameters**:
- `?selected=BSSID1,BSSID2` - Multiple networks
- `?selected=BSSID&lat=43.0&lng=-83.6` - Single network with coords

**Function Added**:
- `highlightSelectedNetworks(bssids)` - Fetch and highlight networks

**Map Load Handler**:
- Checks URL parameters
- Flies to single network or fits bounds for multiple
- Shows popups for selected networks

## Data Flow

```
Networks Page
    ↓
User double-clicks row OR selects multiple + clicks button
    ↓
sessionStorage.setItem('selectedNetworks', JSON.stringify([bssids]))
    ↓
window.location.href = '/geospatial.html?selected=...'
    ↓
Geospatial Page
    ↓
Parse URL parameters
    ↓
Fetch network data
    ↓
Fly to location OR fit bounds
    ↓
Show popups
```

## Edge Cases Handled

1. **No Location Data**: Alert shown, no navigation
2. **No Networks Selected**: Button disabled
3. **Single Network**: Flies to exact location (zoom 16)
4. **Multiple Networks**: Fits bounds with padding
5. **Map Not Loaded**: Waits for map.on('load') event

## Future Enhancements

1. **Highlight on Map**: Add colored markers for selected networks
2. **Persistent Selection**: Remember selection across page refreshes
3. **Filter by Selection**: Show only selected networks in sidebar
4. **Bulk Actions**: Export, tag, or analyze selected networks
5. **Keyboard Shortcuts**: Ctrl+M to jump to map
6. **Right-Click Menu**: Context menu on rows with "Show on Map"

## Testing

### Test Double-Click
1. Go to http://localhost:3001/networks.html
2. Double-click any network row
3. Should navigate to geospatial page
4. Map should fly to network location

### Test Multi-Select
1. Go to http://localhost:3001/networks.html
2. Check 3-5 network checkboxes
3. Click "📍 Jump to Map (N)" button
4. Should navigate to geospatial page
5. Map should show all selected networks with popups

### Test Select All
1. Go to http://localhost:3001/networks.html
2. Click "Select All" checkbox in header
3. All network checkboxes should be checked
4. Button should show total count
5. Click button to jump to map

## Files Modified

- `/public/networks.html` - Added checkbox column, selection logic, jump functions
- `/public/geospatial.html` - Added URL parameter handling, highlight function
