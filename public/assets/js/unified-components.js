/**
 * ShadowCheck Unified Component System
 * Provides resizable/movable cards with snap-to-grid and unified filtering
 */

class UnifiedCardSystem {
    constructor() {
        this.cards = new Map();
        this.layouts = this.loadLayouts();
        this.gridSize = 20; // Snap grid size in pixels
        this.snapEnabled = true;
    }

    loadLayouts() {
        const saved = localStorage.getItem('shadowcheck_layouts');
        return saved ? JSON.parse(saved) : {};
    }

    saveLayouts() {
        localStorage.setItem('shadowcheck_layouts', JSON.stringify(this.layouts));
    }

    snap(value) {
        if (!this.snapEnabled) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        return this.snapEnabled;
    }

    makeResizable(element) {
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.innerHTML = '⋮⋮';
        element.appendChild(handle);

        let startX, startY, startWidth, startHeight;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startWidth = element.offsetWidth;
            startHeight = element.offsetHeight;

            const onMouseMove = (e) => {
                let width = startWidth + (e.clientX - startX);
                let height = startHeight + (e.clientY - startY);
                
                width = this.snap(Math.max(200, width));
                height = this.snap(Math.max(150, height));
                
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

    makeDraggable(element) {
        const header = element.querySelector('.panel-header, .card-header');
        if (!header) return;

        header.style.cursor = 'move';
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.resize-handle') || e.target.closest('button') || e.target.closest('select')) return;
            
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            if (element.style.position !== 'absolute') {
                element.style.position = 'absolute';
                element.style.left = startLeft + 'px';
                element.style.top = startTop + 'px';
            }
            element.style.zIndex = '1001';

            const onMouseMove = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                let left = this.snap(startLeft + dx);
                let top = this.snap(startTop + dy);
                
                element.style.left = left + 'px';
                element.style.top = top + 'px';
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

    restoreCardLayout(element) {
        const id = element.id || element.dataset.cardId;
        if (!id) return;

        const page = window.location.pathname;
        const layout = this.layouts[page]?.[id];
        
        if (layout) {
            Object.assign(element.style, layout);
        }
    }

    enableCard(element) {
        this.makeResizable(element);
        this.makeDraggable(element);
        this.restoreCardLayout(element);
        element.classList.add('unified-card');
    }

    resetLayout() {
        const page = window.location.pathname;
        delete this.layouts[page];
        this.saveLayouts();
        location.reload();
    }
}

class UnifiedFilterSystem {
    constructor() {
        this.filters = {};
        this.subscribers = [];
    }

    setFilter(key, value) {
        this.filters[key] = value;
        this.notify();
    }

    getFilter(key) {
        return this.filters[key];
    }

    getAllFilters() {
        return { ...this.filters };
    }

    clearFilters() {
        this.filters = {};
        this.notify();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notify() {
        this.subscribers.forEach(cb => cb(this.filters));
    }

    createFilterBar(container) {
        const bar = document.createElement('div');
        bar.className = 'unified-filter-bar';
        bar.innerHTML = `
            <div class="filter-group">
                <input type="search" id="global-search" placeholder="Search all..." class="filter-input">
                <select id="global-type" class="filter-select">
                    <option value="">All Types</option>
                    <option value="W">WiFi</option>
                    <option value="B">Bluetooth</option>
                    <option value="E">BLE</option>
                    <option value="L">LTE</option>
                    <option value="N">5G NR</option>
                </select>
                <select id="global-security" class="filter-select">
                    <option value="">All Security</option>
                    <option value="OPEN">Open</option>
                    <option value="WEP">WEP</option>
                    <option value="WPA">WPA</option>
                    <option value="WPA2">WPA2</option>
                    <option value="WPA3">WPA3</option>
                </select>
                <button class="btn btn-sm" onclick="window.unifiedFilters.clearFilters()">Clear</button>
            </div>
        `;

        container.insertBefore(bar, container.firstChild);

        document.getElementById('global-search').addEventListener('input', (e) => {
            this.setFilter('search', e.target.value);
        });

        document.getElementById('global-type').addEventListener('change', (e) => {
            this.setFilter('type', e.target.value);
        });

        document.getElementById('global-security').addEventListener('change', (e) => {
            this.setFilter('security', e.target.value);
        });
    }
}

// Global instances
window.unifiedCards = new UnifiedCardSystem();
window.unifiedFilters = new UnifiedFilterSystem();

// Show card library modal
function showCardLibrary() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    modal.innerHTML = `
        <div style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 12px; padding: 24px; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 18px;">📚 Card Library</h2>
                <button onclick="this.closest('div').parentElement.remove()" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="display: grid; gap: 12px;">
                <div class="card-option" onclick="addCardToPage('networkList')" style="padding: 16px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; cursor: pointer;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📡</div>
                    <div style="font-weight: 600; margin-bottom: 4px;">Network List</div>
                    <div style="font-size: 12px; color: #94a3b8;">Searchable table of all networks with column customization</div>
                </div>
                <div class="card-option" onclick="addCardToPage('threatList')" style="padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; cursor: pointer;">
                    <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                    <div style="font-weight: 600; margin-bottom: 4px;">Threat List</div>
                    <div style="font-size: 12px; color: #94a3b8;">Active threats with severity badges and filtering</div>
                </div>
                <div class="card-option" onclick="addCardToPage('mapViewer')" style="padding: 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; cursor: pointer;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🗺️</div>
                    <div style="font-weight: 600; margin-bottom: 4px;">Map Viewer</div>
                    <div style="font-size: 12px; color: #94a3b8;">Interactive map showing network locations</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function addCardToPage(cardType) {
    const main = document.querySelector('.app-main, .main, main');
    if (!main) {
        alert('Cannot find main content area');
        return;
    }
    
    const cardId = `${cardType}-${Date.now()}`;
    const container = document.createElement('div');
    container.id = cardId;
    container.className = 'panel';
    
    // Set default sizes based on card type
    const sizes = {
        networkList: { width: 800, height: 500 },
        threatList: { width: 700, height: 450 },
        mapViewer: { width: 900, height: 600 }
    };
    const size = sizes[cardType] || { width: 600, height: 400 };
    
    container.style.cssText = `position: absolute; top: 100px; left: 100px; width: ${size.width}px; height: ${size.height}px; z-index: 100;`;
    
    const card = window.CardLibrary[cardType];
    if (!card) {
        alert('Card type not found');
        return;
    }
    
    container.innerHTML = `
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${card.title}</span>
            <button onclick="document.getElementById('${cardId}').remove()" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 0 8px;" title="Remove card">&times;</button>
        </div>
        <div class="panel-body" id="${cardId}-body"></div>
    `;
    main.appendChild(container);
    
    card.render(document.getElementById(`${cardId}-body`));
    window.unifiedCards.enableCard(container);
    
    // Close modal
    document.querySelector('[onclick*="showCardLibrary"]')?.closest('div')?.parentElement?.remove();
}

window.showCardLibrary = showCardLibrary;

// Auto-initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Enable all panels as resizable/draggable cards
    document.querySelectorAll('.panel, .card').forEach(panel => {
        if (!panel.dataset.cardId && !panel.id) {
            panel.dataset.cardId = 'card-' + Math.random().toString(36).substr(2, 9);
        }
        window.unifiedCards.enableCard(panel);
    });

    // Add controls to header if not exists
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !document.getElementById('unified-controls')) {
        const controls = document.createElement('div');
        controls.id = 'unified-controls';
        controls.style.cssText = 'display: flex; gap: 8px;';
        controls.innerHTML = `
            <button class="btn btn-sm" onclick="showCardLibrary()">➕ Add Card</button>
            <button class="btn btn-sm" onclick="window.unifiedCards.toggleSnap(); this.textContent = window.unifiedCards.snapEnabled ? '🔲 Snap: ON' : '🔲 Snap: OFF'">🔲 Snap: ON</button>
            <button class="btn btn-sm" onclick="window.unifiedCards.resetLayout()">↺ Reset</button>
        `;
        headerRight.insertBefore(controls, headerRight.firstChild);
    }
});
