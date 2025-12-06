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
                    <div class="logo">SC</div>
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
        this.snapEnabled = !this.snapEnabled;
        if (button) button.textContent = this.snapEnabled ? '🔲 Snap: ON' : '🔲 Snap: OFF';
        return this.snapEnabled;
    }

    // Reset layout
    resetLayout() {
        const page = window.location.pathname;
        delete this.layouts[page];
        this.saveLayouts();
        location.reload();
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
            position: element.style.position
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

    // Show card library (placeholder)
    showCardLibrary() {
        alert('Card library coming soon!\n\nThis will let you add:\n- Network List\n- Threat List\n- Map Viewer\n\nto any page.');
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
        document.querySelectorAll('.panel, .card').forEach(panel => {
            this.enableCard(panel);
        });
    }
}

// Global instance
window.baseComponents = new BaseComponents();

// Auto-init on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const pageName = document.body.dataset.page || 
                     window.location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 
                     'dashboard';
    window.baseComponents.init(pageName);
});
