# ShadowCheck Full-Screen Layout Standard

## CSS Architecture

All pages MUST use: `<link rel="stylesheet" href="/assets/styles/unified.css">`

## HTML Structure Template

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShadowCheck - [Page Name]</title>
    <link rel="stylesheet" href="/assets/styles/unified.css" />
  </head>
  <body>
    <div class="app-container">
      <!-- Header -->
      <header class="app-header">
        <div class="header-left">
          <div class="logo">SC</div>
          <span class="font-semibold">ShadowCheck</span>
        </div>
        <nav class="nav-links">
          <a href="/" class="nav-link">Dashboard</a>
          <a href="/networks.html" class="nav-link">Networks</a>
          <a href="/geospatial.html" class="nav-link">Geospatial</a>
          <a href="/surveillance.html" class="nav-link">Surveillance</a>
          <a href="/analytics.html" class="nav-link">Analytics</a>
          <a href="/admin.html" class="nav-link">Admin</a>
        </nav>
        <div class="header-right">
          <!-- Status indicators, user menu, etc -->
        </div>
      </header>

      <!-- Main Content -->
      <main class="app-main">
        <!-- Content goes here -->
      </main>
    </div>
  </body>
</html>
```

## Layout Patterns

### 1. Dashboard Grid (index.html)

```html
<main class="app-main">
  <div class="grid grid-4 mb-3">
    <div class="metric-card">...</div>
  </div>
  <div class="grid grid-2" style="flex: 1;">
    <div class="panel">...</div>
  </div>
</main>
```

### 2. Full-Screen Table (networks.html)

```html
<main class="app-main">
  <div class="filters">...</div>
  <div class="panel" style="flex: 1;">
    <div class="panel-header">...</div>
    <div class="panel-body no-padding">
      <table>
        ...
      </table>
    </div>
  </div>
</main>
```

### 3. Map + Sidebars (geospatial.html)

```html
<main class="app-main">
  <div class="grid grid-2" style="flex: 1;">
    <div class="panel">
      <div class="panel-body no-padding">
        <div id="map"></div>
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <div class="panel">...</div>
    </div>
  </div>
</main>
```

## Key Rules

1. **No inline styles in `<style>` tags** - use unified.css classes
2. **Header height**: Fixed at 56px
3. **Main content**: Uses `flex: 1` to fill remaining space
4. **All panels**: Use `.panel` class with `.panel-header` and `.panel-body`
5. **Scrolling**: Only within `.panel-body`, never on body
6. **Spacing**: Use 12px gaps consistently
7. **No overflow on html/body**: Always `overflow: hidden`
