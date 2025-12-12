/**
 * ShadowCheck Global Application Initialization
 * Handles theme setup, active page detection, and global state
 * Last Updated: 2025-12-05
 */

(() => {
  'use strict';

  /**
   * Get current page name from URL or default to 'dashboard'
   * Handles both /page.html and / (root) paths
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return filename.replace('.html', '') || 'dashboard';
  }

  /**
   * Initialize navigation active state
   * Sets the active class on the current page's nav tab
   */
  function initializeNavigation() {
    const currentPage = getCurrentPage();

    // Map filenames to nav data-page values
    const pageMap = {
      index: 'dashboard',
      dashboard: 'dashboard',
      geospatial: 'geospatial',
      analytics: 'analytics',
      networks: 'networks',
      surveillance: 'surveillance',
      admin: 'admin',
      '': 'dashboard',
    };

    const pageKey = pageMap[currentPage] || currentPage;

    // Find and activate the corresponding nav tab
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.page === pageKey) {
        tab.classList.add('active');
      }
    });
  }

  /**
   * Initialize theme from localStorage or system preference
   * Defaults to dark theme
   */
  function initializeTheme() {
    const storedTheme = localStorage.getItem('theme-preference');
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const theme = storedTheme || systemPreference || 'dark';

    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme-preference', theme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = newTheme;
      localStorage.setItem('theme-preference', newTheme);
    });
  }

  /**
   * API helper: Construct dynamic API base URL
   * Supports deployment flexibility (localhost:3001, https://api.example.com, etc.)
   */
  window.getApiBaseUrl = function () {
    const { protocol, hostname, port } = window.location;

    // Use the current host but with port 3001 for API
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001`;
    }

    // For deployed environments, assume API is at same origin
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
  };

  /**
   * Fetch wrapper with error handling
   * Returns { ok, data } or { ok, error }
   */
  window.fetchAPI = async function (endpoint, options = {}) {
    try {
      const url = `${window.getApiBaseUrl()}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error.message);
      return { ok: false, error: error.message };
    }
  };

  /**
   * HTML entity escape for XSS prevention
   */
  window.escapeHtml = function (text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  };

  /**
   * Format number with thousands separator
   */
  window.formatNumber = function (num) {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  };

  /**
   * Format timestamp to readable date
   */
  window.formatDate = function (timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(parseInt(timestamp)).toLocaleString();
    } catch (e) {
      return '';
    }
  };

  /**
   * Initialize when DOM is ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeTheme();
      initializeNavigation();
    });
  } else {
    // DOM already loaded
    initializeTheme();
    initializeNavigation();
  }

  /**
   * Global error handler for unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent default browser error
    event.preventDefault();
  });

  /**
   * Log app initialization
   */
  console.log('ShadowCheck App Initialized', {
    page: getCurrentPage(),
    theme: document.documentElement.dataset.theme,
    apiBase: window.getApiBaseUrl(),
  });
})();
