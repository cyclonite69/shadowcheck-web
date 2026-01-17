# Radio Icon System

Centralized icon component for displaying radio types consistently across all pages.

## Usage

```javascript
// Basic usage - returns HTML string
getRadioIcon('wifi'); // Returns: <span>📶 WiFi</span>

// With options
getRadioIcon('bluetooth', { size: 'md', showLabel: true });
getRadioIcon('lte', { size: 'lg', showLabel: false });

// Using RadioIcons object directly
RadioIcons.getIcon('ble');
RadioIcons.getSymbol('gsm'); // Returns just the emoji
RadioIcons.getLabel('5g'); // Returns just the text
```

## Supported Types

| Type      | Symbol | Label | Color     |
| --------- | ------ | ----- | --------- |
| wifi      | 📶     | WiFi  | Blue      |
| bluetooth | 🔵     | BT    | Blue      |
| ble       | 💠     | BLE   | Dark Blue |
| lte       | 📱     | LTE   | Purple    |
| gsm       | 📞     | GSM   | Purple    |
| nr / 5g   | 5️⃣     | 5G    | Magenta   |

## Options

- `size`: 'sm' (default), 'md', 'lg'
- `showLabel`: true (default), false
- `inline`: true (default), false

## Implementation

File: `/public/assets/js/radio-icons.js`

Loaded on all pages before unified-card-library.js

## Examples

```javascript
// In threat lists
item.innerHTML = `
    ${getRadioIcon(threat.radioType)}
    <span>${threat.ssid}</span>
`;

// In network tables
row.innerHTML = `
    <td>${getRadioIcon(network.type, { size: 'sm' })}</td>
    <td>${network.bssid}</td>
`;
```

## Migration

Old inline badges have been replaced with centralized `getRadioIcon()` calls across:

- surveillance.html (3 lists)
- networks.html
- geospatial.html
- All card components
