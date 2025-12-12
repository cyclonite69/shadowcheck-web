// API Configuration - uses relative paths for portability
const API_BASE = '/api';
const API_KEY = localStorage.getItem('shadowcheck_api_key') || '';

// Fetch with API key and error handling
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `${API_BASE}/${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      showError('Authentication required. Please set your API key.');
      return null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    showError(err.message);
    throw err;
  }
}

// Show error banner
function showError(message) {
  let banner = document.getElementById('error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'error-banner';
    banner.className = 'error-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }
  banner.textContent = message;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 5000);
}

// Highlight active navigation
function highlightActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/index.html')) {
      a.classList.add('active');
    }
  });
}

// Debounce function for scroll handlers
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Set API key (call from console or settings UI)
function setApiKey(key) {
  localStorage.setItem('shadowcheck_api_key', key);
  location.reload();
}

// Initialize common features
document.addEventListener('DOMContentLoaded', () => {
  highlightActiveNav();

  // Update copyright year
  const footer = document.querySelector('footer');
  if (footer) {
    footer.innerHTML = footer.innerHTML.replace(/©\s*\d{4}/, `© ${new Date().getFullYear()}`);
  }
});
