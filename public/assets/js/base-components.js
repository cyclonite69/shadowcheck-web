/**
 * ShadowCheck Base Components
 * Single source of truth for all reusable components
 */

// ============================================================================
// UNIFIED HEADER
// ============================================================================
class UnifiedHeader {
  constructor(activePage) {
    this.activePage = activePage;
  }

  render() {
    return `
            <header class="app-header">
                <div class="header-left">
                    <div class="logo"><img src="/favicon.svg" alt="SC" style="width: 32px; height: 32px;"></div>
                    <span class="font-semibold">ShadowCheck</span>
                </div>
                <nav class="nav-links">
                    <a href="/" class="nav-link ${this.activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
                    <a href="/networks.html" class="nav-link ${this.activePage === 'networks' ? 'active' : ''}">Networks</a>
                    <a href="/geospatial.html" class="nav-link ${this.activePage === 'geospatial' ? 'active' : ''}">Geospatial</a>
                    <a href="/surveillance.html" class="nav-link ${this.activePage === 'surveillance' ? 'active' : ''}">Surveillance</a>
                    <a href="/analytics.html" class="nav-link ${this.activePage === 'analytics' ? 'active' : ''}">Analytics</a>
                    <a href="/admin.html" class="nav-link ${this.activePage === 'admin' ? 'active' : ''}">Admin</a>
                </nav>
                <div class="header-right">
                    <button class="btn btn-sm" onclick="window.baseComponents?.showCardLibrary()">➕ Add Card</button>
                    <button class="btn btn-sm" onclick="window.baseComponents?.toggleSnap(this)">🔲 Snap: ON</button>
                    <button class="btn btn-sm" onclick="window.baseComponents?.resetLayout()">🎯 Demo Layout</button>
                    <button class="btn btn-sm" onclick="window.location.reload()">🔄 Refresh</button>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>Online</span>
                    </div>
                </div>
            </header>
        `;
  }

  inject(container) {
    const existing = container.querySelector('.app-header, header');
    if (existing) existing.remove();
    container.insertAdjacentHTML('afterbegin', this.render());
  }
}

// ============================================================================
// BASE COMPONENTS MANAGER
// ============================================================================
class BaseComponents {
  constructor() {
    this.snapEnabled = true;
    this.gridSize = 20;
    this.layouts = this.loadLayouts();
  }

  // Layout persistence
  loadLayouts() {
    const saved = localStorage.getItem('shadowcheck_layouts');
    return saved ? JSON.parse(saved) : {};
  }

  saveLayouts() {
    localStorage.setItem('shadowcheck_layouts', JSON.stringify(this.layouts));
  }

  // Snap to grid
  snap(value) {
    return this.snapEnabled ? Math.round(value / this.gridSize) * this.gridSize : value;
  }

  toggleSnap(button) {
    if (window.unifiedCards) {
      window.unifiedCards.toggleSnap();
      if (button)
        button.textContent = window.unifiedCards.snapEnabled ? '🔲 Snap: ON' : '🔲 Snap: OFF';
      return window.unifiedCards.snapEnabled;
    }
    this.snapEnabled = !this.snapEnabled;
    if (button) button.textContent = this.snapEnabled ? '🔲 Snap: ON' : '🔲 Snap: OFF';
    return this.snapEnabled;
  }

  // Reset layout
  resetLayout() {
    if (window.unifiedCards) {
      window.unifiedCards.resetLayout();
    } else {
      const page = window.location.pathname;
      delete this.layouts[page];
      this.saveLayouts();
      this.setDemoLayout(); // Use demo layout instead of reload
    }
  }

  // Set demo-ready layout for each page
  setDemoLayout() {
    const page = document.body.dataset.page;
    let layout;

    switch (page) {
      case 'dashboard':
        layout = {
          'threat-summary': { x: 0, y: 0, w: 4, h: 2 },
          'network-count': { x: 4, y: 0, w: 4, h: 2 },
          'recent-activity': { x: 8, y: 0, w: 4, h: 2 },
          'threat-map': { x: 0, y: 2, w: 8, h: 4 },
          'activity-chart': { x: 8, y: 2, w: 4, h: 4 },
        };
        break;
      case 'geospatial':
        layout = {
          'map-panel': { x: 0, y: 0, w: 8, h: 6 },
          'network-list': { x: 8, y: 0, w: 4, h: 3 },
          'map-controls': { x: 8, y: 3, w: 4, h: 3 },
        };
        break;
      case 'networks':
        layout = {
          'network-explorer': { x: 0, y: 0, w: 12, h: 4 },
          'network-details': { x: 0, y: 4, w: 6, h: 2 },
          'network-stats': { x: 6, y: 4, w: 6, h: 2 },
        };
        break;
      case 'analytics':
        layout = {
          'signal-strength-chart': { x: 0, y: 0, w: 6, h: 3 },
          'network-types-chart': { x: 6, y: 0, w: 6, h: 3 },
          'timeline-chart': { x: 0, y: 3, w: 12, h: 3 },
        };
        break;
      case 'admin':
        layout = {
          'sqlite-import': { x: 0, y: 0, w: 4, h: 3 },
          'wigle-api': { x: 4, y: 0, w: 4, h: 3 },
          'system-status': { x: 8, y: 0, w: 4, h: 3 },
          'mapbox-tokens': { x: 0, y: 3, w: 4, h: 2 },
          'database-panel': { x: 4, y: 3, w: 4, h: 2 },
          'home-location': { x: 8, y: 3, w: 4, h: 2 },
          'export-geojson': { x: 0, y: 5, w: 3, h: 1 },
          'export-json': { x: 3, y: 5, w: 3, h: 1 },
          'export-csv': { x: 6, y: 5, w: 3, h: 1 },
        };
        break;
      case 'surveillance':
        layout = {
          'threat-detection': { x: 0, y: 0, w: 8, h: 4 },
          'threat-list': { x: 8, y: 0, w: 4, h: 4 },
          'ml-status': { x: 0, y: 4, w: 6, h: 2 },
          'detection-stats': { x: 6, y: 4, w: 6, h: 2 },
        };
        break;
    }

    if (layout) {
      this.layouts[window.location.pathname] = layout;
      this.saveLayouts();
      this.applyLayout(layout);
    }
  }

  // Apply layout to cards
  applyLayout(layout) {
    Object.entries(layout).forEach(([cardId, pos]) => {
      const card = document.getElementById(cardId);
      if (card) {
        card.style.gridColumn = `${pos.x + 1} / span ${pos.w}`;
        card.style.gridRow = `${pos.y + 1} / span ${pos.h}`;
      }
    });
  }

  // Make card resizable
  makeResizable(element) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.innerHTML = '⋮⋮';
    element.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = element.offsetWidth;
      const startHeight = element.offsetHeight;

      const onMouseMove = (e) => {
        const width = this.snap(Math.max(200, startWidth + (e.clientX - startX)));
        const height = this.snap(Math.max(150, startHeight + (e.clientY - startY)));
        element.style.width = width + 'px';
        element.style.height = height + 'px';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.saveCardLayout(element);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // Make card draggable
  makeDraggable(element) {
    const header = element.querySelector('.panel-header, .card-header');
    if (!header) return;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.resize-handle, button, select, input')) return;

      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = element.getBoundingClientRect();
      const startLeft = rect.left;
      const startTop = rect.top;

      if (element.style.position !== 'absolute') {
        element.style.position = 'absolute';
        element.style.left = startLeft + 'px';
        element.style.top = startTop + 'px';
      }
      element.style.zIndex = '1001';

      const onMouseMove = (e) => {
        const left = this.snap(startLeft + (e.clientX - startX));
        const top = this.snap(startTop + (e.clientY - startY));

        // Calculate actual top offset from header + toolbar
        const header = document.querySelector('.app-header');
        const toolbar = document.querySelector('.app-toolbar');
        const minTop = (header?.offsetHeight || 56) + (toolbar?.offsetHeight || 0);
        const maxTop = window.innerHeight - 100;
        const maxLeft = window.innerWidth - 100;

        element.style.left = Math.max(0, Math.min(left, maxLeft)) + 'px';
        element.style.top = Math.max(minTop, Math.min(top, maxTop)) + 'px';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.saveCardLayout(element);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // Save card layout
  saveCardLayout(element) {
    const id = element.id || element.dataset.cardId;
    if (!id) return;

    const page = window.location.pathname;
    if (!this.layouts[page]) this.layouts[page] = {};

    this.layouts[page][id] = {
      width: element.style.width,
      height: element.style.height,
      left: element.style.left,
      top: element.style.top,
      position: element.style.position,
    };

    this.saveLayouts();
  }

  // Restore card layout
  restoreCardLayout(element) {
    const id = element.id || element.dataset.cardId;
    if (!id) return;

    const page = window.location.pathname;
    const layout = this.layouts[page]?.[id];

    if (layout) Object.assign(element.style, layout);
  }

  // Enable card (resize + move)
  enableCard(element) {
    if (!element.dataset.cardId && !element.id) {
      element.dataset.cardId = 'card-' + Math.random().toString(36).substr(2, 9);
    }
    this.makeResizable(element);
    this.makeDraggable(element);
    this.restoreCardLayout(element);
    element.classList.add('unified-card');
  }

  // Show card library
  showCardLibrary() {
    if (typeof showCardLibrary === 'function') {
      showCardLibrary();
    } else {
      alert('Card library not loaded');
    }
  }

  // Initialize on page
  init(pageName) {
    // Inject header
    const container = document.querySelector('.app-container, .container, body');
    if (container) {
      const header = new UnifiedHeader(pageName);
      header.inject(container);
    }

    // Enable all panels
    document.querySelectorAll('.panel, .card').forEach((panel) => {
      this.enableCard(panel);
    });
  }
}

// Global instance
window.baseComponents = new BaseComponents();

// Auto-init on DOM load
document.addEventListener('DOMContentLoaded', () => {
  const pageName =
    document.body.dataset.page ||
    window.location.pathname.replace(/\.html$/, '').replace(/^\//, '') ||
    'dashboard';
  window.baseComponents.init(pageName);
});
