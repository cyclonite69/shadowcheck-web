/**
 * Unified Header Component
 * Ensures consistent navigation across all pages
 */

function createUnifiedHeader(activePage) {
  const header = document.createElement('header');
  header.className = 'app-header';

  header.innerHTML = `
        <div class="header-left">
            <div class="logo">SC</div>
            <span class="font-semibold">ShadowCheck</span>
        </div>
        <nav class="nav-links">
            <a href="/" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
            <a href="/networks.html" class="nav-link ${activePage === 'networks' ? 'active' : ''}">Networks</a>
            <a href="/geospatial.html" class="nav-link ${activePage === 'geospatial' ? 'active' : ''}">Geospatial</a>
            <a href="/surveillance.html" class="nav-link ${activePage === 'surveillance' ? 'active' : ''}">Surveillance</a>
            <a href="/analytics.html" class="nav-link ${activePage === 'analytics' ? 'active' : ''}">Analytics</a>
            <a href="/admin.html" class="nav-link ${activePage === 'admin' ? 'active' : ''}">Admin</a>
        </nav>
        <div class="header-right">
            <button class="btn btn-sm" onclick="window.unifiedCards?.resetLayout()">↺ Reset</button>
            <div class="status-indicator">
                <div class="status-dot"></div>
                <span>Online</span>
            </div>
        </div>
    `;

  return header;
}

// Auto-inject header if app-container exists but no header
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.app-container');
  if (container && !container.querySelector('.app-header')) {
    const activePage =
      document.body.dataset.page ||
      window.location.pathname.replace(/\.html$/, '').replace(/^\//, '') ||
      'dashboard';
    const header = createUnifiedHeader(activePage);
    container.insertBefore(header, container.firstChild);
  }
});
