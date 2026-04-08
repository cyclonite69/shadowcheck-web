export const BrandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="#60a5fa" strokeWidth="1" />
    <circle cx="6.5" cy="6.5" r="1.8" fill="#60a5fa" />
    <line x1="6.5" y1="0.5" x2="6.5" y2="3" stroke="#60a5fa" strokeWidth="0.9" />
    <line x1="6.5" y1="10" x2="6.5" y2="12.5" stroke="#60a5fa" strokeWidth="0.9" />
    <line x1="0.5" y1="6.5" x2="3" y2="6.5" stroke="#60a5fa" strokeWidth="0.9" />
    <line x1="10" y1="6.5" x2="12.5" y2="6.5" stroke="#60a5fa" strokeWidth="0.9" />
  </svg>
);

export const FitIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <polyline points="1,4 1,1 4,1" />
    <polyline points="10,1 13,1 13,4" />
    <polyline points="13,10 13,13 10,13" />
    <polyline points="4,13 1,13 1,10" />
  </svg>
);

export const HomeIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M2 7L7 2L12 7" />
    <path d="M3 7V12H6V9H8V12H11V7" />
  </svg>
);

export const ChevronDownIcon = () => <span style={{ opacity: 0.5, marginLeft: '6px' }}>▾</span>;

export const CheckIcon = () => <span style={{ color: '#60a5fa' }}>✓</span>;
