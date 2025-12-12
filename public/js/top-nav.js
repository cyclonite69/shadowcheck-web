/**
 * ShadowCheck Top Navigation Bar
 * Renders and manages the sticky top navigation component
 * Last Updated: 2025-12-05
 */

(() => {
  'use strict';

  /**
   * Top navigation HTML template
   */
  function getTopNavHTML() {
    return `
      <div class="top-nav-bar">
        <div class="top-nav-left">
          <a href="/index.html" class="logo-section" title="ShadowCheck Dashboard">
            <div class="logo-icon">
              <span class="logo-icon-char">S</span>
            </div>
            <div class="logo-text">
              <h1 class="logo-title">ShadowCheck</h1>
              <p class="logo-subtitle">SIGINT Platform</p>
            </div>
          </a>
        </div>

        <div class="top-nav-center">
          <nav class="nav-tabs">
            <a href="/index.html" class="nav-tab" data-page="dashboard">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-chart-bar"></use>
              </svg>
              <span class="nav-tab-text">Dashboard</span>
            </a>
            <a href="/geospatial.html" class="nav-tab" data-page="geospatial">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-map-pin"></use>
              </svg>
              <span class="nav-tab-text">Geospatial</span>
            </a>
            <a href="/analytics.html" class="nav-tab" data-page="analytics">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-layers"></use>
              </svg>
              <span class="nav-tab-text">Analytics</span>
            </a>
            <a href="/surveillance.html" class="nav-tab" data-page="surveillance">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-eye"></use>
              </svg>
              <span class="nav-tab-text">Surveillance</span>
            </a>
            <a href="/networks.html" class="nav-tab" data-page="networks">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-network"></use>
              </svg>
              <span class="nav-tab-text">Networks</span>
            </a>
            <a href="/admin.html" class="nav-tab" data-page="admin">
              <svg class="icon icon-sm">
                <use href="/assets/icons/icons.svg#icon-gear"></use>
              </svg>
              <span class="nav-tab-text">Admin</span>
            </a>
          </nav>
        </div>

        <div class="top-nav-right">
          <div class="status-indicator">
            <div class="online-dot"></div>
            <span class="online-text">Online</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Inject top navigation into page
   * Looks for #top-nav-container or creates one
   */
  function injectTopNav() {
    // Find or create container
    let container = document.getElementById('top-nav-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'top-nav-container';
      document.body.insertBefore(container, document.body.firstChild);
    }

    // Inject HTML
    container.innerHTML = getTopNavHTML();

    // Load SVG icon sprite if not already loaded
    loadIconSprite();
  }

  /**
   * Load SVG icon sprite
   * Appends icons.svg to document if not present
   */
  function loadIconSprite() {
    // Check if icons are already loaded
    if (document.querySelector('svg[style*="display: none"]')) {
      return;
    }

    // Fetch and inject icon sprite
    fetch('/assets/icons/icons.svg')
      .then((response) => response.text())
      .then((svg) => {
        // Create temporary container to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = svg;

        // Find the SVG element
        const svgElement = temp.querySelector('svg');

        if (svgElement) {
          // Keep it hidden
          svgElement.style.display = 'none';

          // Insert at end of body if not already present
          if (!document.body.querySelector('svg[style*="display: none"] symbol')) {
            document.body.appendChild(svgElement);
          }
        }
      })
      .catch((err) => console.error('Failed to load icon sprite:', err));
  }

  /**
   * Initialize top navigation when DOM is ready
   */
  function initialize() {
    // Wait for app.js to initialize if needed
    setTimeout(() => {
      injectTopNav();
    }, 100);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Export for manual use if needed
  window.TopNav = {
    render: injectTopNav,
    getHTML: getTopNavHTML,
  };
})();
