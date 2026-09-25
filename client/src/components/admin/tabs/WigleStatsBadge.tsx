export interface WigleUserStats {
  user?: string | null;
  rank?: number | string | null;
  discoveredWiFiGPS?: number | string | null;
  discoveredBtGPS?: number | string | null;
  discoveredCellGPS?: number | string | null;
  last?: string | null;
}

const toFiniteNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatBadgeNumber = (value: number | string | null | undefined): string => {
  const numeric = toFiniteNumber(value);
  if (numeric >= 1_000_000_000) {
    return `${(numeric / 1_000_000_000).toFixed(1)}B`;
  }
  if (numeric >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (numeric >= 10_000) {
    return `${Math.round(numeric / 1_000)}K`;
  }
  return numeric.toLocaleString();
};

export const getGpsDiscoveryTotal = (stats: WigleUserStats | null | undefined): number => {
  return (
    toFiniteNumber(stats?.discoveredWiFiGPS) +
    toFiniteNumber(stats?.discoveredBtGPS) +
    toFiniteNumber(stats?.discoveredCellGPS)
  );
};

export const WigleStatsBadge = ({ stats }: { stats: WigleUserStats | null | undefined }) => {
  const user = stats?.user || 'WiGLE user';
  const rank = stats?.rank ? `#${formatBadgeNumber(stats.rank)}` : 'Unranked';
  const wifi = formatBadgeNumber(stats?.discoveredWiFiGPS);
  const bluetooth = formatBadgeNumber(stats?.discoveredBtGPS);
  const cell = formatBadgeNumber(stats?.discoveredCellGPS);
  const totalGps = formatBadgeNumber(getGpsDiscoveryTotal(stats));
  const lastSeen = stats?.last ? stats.last.substring(0, 8) : 'No recent sync';

  return (
    <svg
      aria-label={`WiGLE stats badge for ${user}`}
      className="w-full max-w-[320px] h-auto rounded-lg shadow-2xl border border-slate-700"
      role="img"
      viewBox="0 0 640 240"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wigleBadgeBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="55%" stopColor="#172554" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="wigleBadgeAccent" x1="0" x2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect width="640" height="240" rx="20" fill="url(#wigleBadgeBg)" />
      <rect x="18" y="18" width="604" height="204" rx="16" fill="#020617" opacity="0.45" />
      <circle cx="548" cy="58" r="58" fill="#38bdf8" opacity="0.12" />
      <circle cx="88" cy="214" r="90" fill="#a78bfa" opacity="0.1" />
      <text
        x="42"
        y="58"
        fill="#67e8f9"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="28"
        fontWeight="800"
      >
        WiGLE
      </text>
      <text
        x="42"
        y="92"
        fill="#cbd5e1"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="20"
        fontWeight="600"
      >
        {user}
      </text>
      <text
        x="42"
        y="144"
        fill="#ffffff"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="54"
        fontWeight="900"
      >
        {rank}
      </text>
      <text
        x="44"
        y="174"
        fill="#94a3b8"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="17"
        fontWeight="700"
      >
        GLOBAL RANK
      </text>
      <rect
        x="348"
        y="42"
        width="232"
        height="42"
        rx="10"
        fill="url(#wigleBadgeAccent)"
        opacity="0.18"
      />
      <text
        x="366"
        y="69"
        fill="#e0f2fe"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="18"
        fontWeight="800"
      >
        GPS DISCOVERIES {totalGps}
      </text>
      <text
        x="348"
        y="126"
        fill="#93c5fd"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="17"
        fontWeight="800"
      >
        WiFi
      </text>
      <text
        x="500"
        y="126"
        fill="#ffffff"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="22"
        fontWeight="900"
        textAnchor="end"
      >
        {wifi}
      </text>
      <text
        x="348"
        y="160"
        fill="#c4b5fd"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="17"
        fontWeight="800"
      >
        Bluetooth
      </text>
      <text
        x="500"
        y="160"
        fill="#ffffff"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="22"
        fontWeight="900"
        textAnchor="end"
      >
        {bluetooth}
      </text>
      <text
        x="348"
        y="194"
        fill="#86efac"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="17"
        fontWeight="800"
      >
        Cell
      </text>
      <text
        x="500"
        y="194"
        fill="#ffffff"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="22"
        fontWeight="900"
        textAnchor="end"
      >
        {cell}
      </text>
      <text
        x="42"
        y="206"
        fill="#64748b"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="15"
        fontWeight="700"
      >
        Last update {lastSeen}
      </text>
    </svg>
  );
};
