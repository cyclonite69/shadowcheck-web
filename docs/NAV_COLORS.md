# Navigation Button Color Scheme

## Unique Active Button Colors

Each navigation button has its own distinct color when active:

### 🔵 Dashboard - Blue

- Color: `#60a5fa` (Light Blue)
- Background: `rgba(59, 130, 246, 0.3)`
- Border: `#3b82f6`

### 🟢 Geospatial - Green

- Color: `#34d399` (Emerald)
- Background: `rgba(16, 185, 129, 0.3)`
- Border: `#10b981`

### 🟣 Analytics - Purple

- Color: `#a78bfa` (Light Purple)
- Background: `rgba(139, 92, 246, 0.3)`
- Border: `#8b5cf6`

### 🔴 Surveillance - Red

- Color: `#f87171` (Light Red)
- Background: `rgba(239, 68, 68, 0.3)`
- Border: `#ef4444`

### 🔷 Networks - Cyan

- Color: `#22d3ee` (Cyan)
- Background: `rgba(6, 182, 212, 0.3)`
- Border: `#06b6d4`

### ⚪ Admin - White

- Color: `#ffffff` (White)
- Background: `rgba(255, 255, 255, 0.15)`
- Border: `#ffffff`

## Visual Summary

| Page         | Color     | Hex     | Description      |
| ------------ | --------- | ------- | ---------------- |
| Dashboard    | 🔵 Blue   | #60a5fa | Main overview    |
| Geospatial   | 🟢 Green  | #34d399 | Map view         |
| Analytics    | 🟣 Purple | #a78bfa | Data analysis    |
| Surveillance | 🔴 Red    | #f87171 | Threat detection |
| Networks     | 🔷 Cyan   | #22d3ee | Network list     |
| Admin        | ⚪ White  | #ffffff | Settings         |

## Implementation

All pages include unique color-coded CSS:

```css
.nav-link.active[href='/'] {
  background: rgba(59, 130, 246, 0.3);
  border-color: #3b82f6;
  color: #60a5fa;
}

.nav-link.active[href='/geospatial.html'] {
  background: rgba(16, 185, 129, 0.3);
  border-color: #10b981;
  color: #34d399;
}

.nav-link.active[href='/analytics.html'] {
  background: rgba(139, 92, 246, 0.3);
  border-color: #8b5cf6;
  color: #a78bfa;
}

.nav-link.active[href='/surveillance.html'] {
  background: rgba(239, 68, 68, 0.3);
  border-color: #ef4444;
  color: #f87171;
}

.nav-link.active[href='/networks.html'] {
  background: rgba(6, 182, 212, 0.3);
  border-color: #06b6d4;
  color: #22d3ee;
}

.nav-link.active[href='/admin.html'] {
  background: rgba(255, 255, 255, 0.15);
  border-color: #ffffff;
  color: #ffffff;
}
```

## Color Rationale

- **Blue** (Dashboard) - Primary/home color
- **Green** (Geospatial) - Maps/location theme
- **Purple** (Analytics) - Data/insights theme
- **Red** (Surveillance) - Alert/warning theme
- **Cyan** (Networks) - Technical/network theme
- **White** (Admin) - Clean/settings theme

All 6 colors are visually distinct and serve their thematic purpose.
