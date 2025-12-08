/**
 * Radio Type Icon System
 * Centralized icon component for consistent display across all pages
 */

const RadioIcons = {
    // Icon definitions with proper Unicode symbols
    icons: {
        'wifi': { symbol: '📶', label: 'WiFi', color: '#3b82f6' },
        'bluetooth': { symbol: '🔵', label: 'BT', color: '#2563eb' },
        'ble': { symbol: '💠', label: 'BLE', color: '#1d4ed8' },
        'lte': { symbol: '📱', label: 'LTE', color: '#7c3aed' },
        'gsm': { symbol: '📞', label: 'GSM', color: '#9333ea' },
        'nr': { symbol: '5️⃣', label: '5G', color: '#c026d3' },
        '5g': { symbol: '5️⃣', label: '5G', color: '#c026d3' }
    },

    /**
     * Get radio icon HTML
     * @param {string} type - Radio type (wifi, bluetooth, ble, lte, gsm, nr)
     * @param {object} options - Styling options
     * @returns {string} HTML string for icon badge
     */
    getIcon(type, options = {}) {
        const normalizedType = (type || 'wifi').toLowerCase();
        const icon = this.icons[normalizedType] || this.icons['wifi'];
        
        const size = options.size || 'sm'; // sm, md, lg
        const showLabel = options.showLabel !== false;
        const inline = options.inline !== false;
        
        // Size mappings
        const sizes = {
            sm: { fontSize: '10px', padding: '2px 6px', symbolSize: '11px' },
            md: { fontSize: '12px', padding: '4px 8px', symbolSize: '14px' },
            lg: { fontSize: '14px', padding: '6px 10px', symbolSize: '16px' }
        };
        
        const s = sizes[size];
        
        const style = `
            display: ${inline ? 'inline-flex' : 'flex'};
            align-items: center;
            gap: 4px;
            background: rgba(59, 130, 246, 0.15);
            color: ${icon.color};
            padding: ${s.padding};
            border-radius: 4px;
            font-size: ${s.fontSize};
            font-weight: 600;
            letter-spacing: 0.3px;
            white-space: nowrap;
        `.replace(/\s+/g, ' ').trim();
        
        const symbolStyle = `font-size: ${s.symbolSize}; line-height: 1;`;
        
        return `<span style="${style}"><span style="${symbolStyle}">${icon.symbol}</span>${showLabel ? icon.label : ''}</span>`;
    },

    /**
     * Get just the symbol without badge styling
     * @param {string} type - Radio type
     * @returns {string} Unicode symbol
     */
    getSymbol(type) {
        const normalizedType = (type || 'wifi').toLowerCase();
        const icon = this.icons[normalizedType] || this.icons['wifi'];
        return icon.symbol;
    },

    /**
     * Get text label only
     * @param {string} type - Radio type
     * @returns {string} Text label
     */
    getLabel(type) {
        const normalizedType = (type || 'wifi').toLowerCase();
        const icon = this.icons[normalizedType] || this.icons['wifi'];
        return icon.label;
    }
};

// Export for global use
window.RadioIcons = RadioIcons;

// Convenience function for backward compatibility
window.getRadioIcon = (type, options) => RadioIcons.getIcon(type, options);
