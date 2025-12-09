/**
 * Network Filtering and Tagging Module
 * Shared across all pages that display network data
 */

const NetworkFilters = {
    // Apply all active filters to network array
    apply(networks, filters = {}) {
        console.log('🔍 Applying filters:', filters);
        console.log('📊 Total networks before filter:', networks.length);
        
        let filtered = [...networks];

        // Search filter (SSID, BSSID, Manufacturer)
        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(n => 
                (n.ssid && n.ssid.toLowerCase().includes(search)) ||
                (n.bssid && n.bssid.toLowerCase().includes(search)) ||
                (n.manufacturer && n.manufacturer.toLowerCase().includes(search))
            );
            console.log('📊 After search filter:', filtered.length);
        }

        // Type filter (map full names to single letter codes)
        if (filters.type) {
            console.log('🔤 Type filter value:', filters.type);
            const typeMap = {
                'wifi': 'W',
                'bluetooth': 'B',
                'ble': 'L',
                'cellular': 'G',
                'nfc': 'N',
                'ethernet': 'E'
            };
            const typeCode = typeMap[filters.type.toLowerCase()] || filters.type;
            console.log('🔤 Mapped to type code:', typeCode);
            console.log('🔤 Sample network types:', filtered.slice(0, 5).map(n => n.type));
            
            filtered = filtered.filter(n => n.type === typeCode);
            console.log('📊 After type filter:', filtered.length);
        }

        // Security filter (check capabilities field)
        if (filters.security) {
            const secUpper = filters.security.toUpperCase();
            filtered = filtered.filter(n => {
                if (!n.capabilities) return false;
                const caps = n.capabilities.toUpperCase();
                
                // Map common security terms to what's in capabilities
                if (secUpper === 'OPEN') return !caps.includes('WPA') && !caps.includes('WEP');
                if (secUpper === 'WEP') return caps.includes('WEP');
                if (secUpper === 'WPA') return caps.includes('WPA') && !caps.includes('WPA2') && !caps.includes('WPA3');
                if (secUpper === 'WPA2') return caps.includes('WPA2');
                if (secUpper === 'WPA3') return caps.includes('WPA3');
                
                return caps.includes(secUpper);
            });
            console.log('📊 After security filter:', filtered.length);
        }

        // Signal strength filter
        if (filters.signal) {
            filtered = filtered.filter(n => {
                const signal = parseInt(n.signal);
                if (isNaN(signal)) return false;
                
                switch(filters.signal) {
                    case 'strong': return signal >= -50;
                    case 'medium': return signal >= -70 && signal < -50;
                    case 'weak': return signal < -70;
                    default: return true;
                }
            });
            console.log('📊 After signal filter:', filtered.length);
        }

        // Threat filter
        if (filters.threat !== undefined) {
            filtered = filtered.filter(n => !!n.is_threat === filters.threat);
            console.log('📊 After threat filter:', filtered.length);
        }

        console.log('✅ Final filtered count:', filtered.length);
        return filtered;
    },

    // Tag networks as threats
    async tagAsThreats(bssids, reason = 'Manual tag') {
        try {
            const response = await fetch(`${window.API_BASE || '/api'}/networks/tag-threats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bssids, reason })
            });

            if (!response.ok) throw new Error('Failed to tag threats');
            return await response.json();
        } catch (error) {
            console.error('Error tagging threats:', error);
            throw error;
        }
    },

    // Remove threat tags
    async untagThreats(bssids) {
        try {
            const response = await fetch(`${window.API_BASE || '/api'}/networks/untag-threats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bssids })
            });

            if (!response.ok) throw new Error('Failed to untag threats');
            return await response.json();
        } catch (error) {
            console.error('Error untagging threats:', error);
            throw error;
        }
    },

    // Get current filter state from UI elements
    getFiltersFromUI() {
        return {
            search: document.getElementById('search-input')?.value || '',
            type: document.getElementById('type-filter')?.value || '',
            security: document.getElementById('security-filter')?.value || '',
            signal: document.getElementById('signal-filter')?.value || '',
            threat: document.getElementById('threat-filter')?.value || undefined
        };
    },

    // Clear all filters
    clearFilters() {
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const securityFilter = document.getElementById('security-filter');
        const signalFilter = document.getElementById('signal-filter');
        const threatFilter = document.getElementById('threat-filter');

        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = '';
        if (securityFilter) securityFilter.value = '';
        if (signalFilter) signalFilter.value = '';
        if (threatFilter) threatFilter.value = '';
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkFilters;
}
