/**
 * BSSID-based color generation for network visualization
 * macColor is the canonical implementation in utils/mapHelpers.ts
 */

import { macColor } from '../mapHelpers';

export { macColor } from '../mapHelpers';

/**
 * Parse HSL color string to components
 */
const parseHsl = (value: string): { h: number; s: number; l: number } | null => {
  const match = value.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
};

/**
 * Mix macColor values for a set of BSSIDs into a single blended HSL color.
 * Uses circular hue averaging so e.g. 350° + 10° → 0° instead of 180°.
 */
export const mixBssidColors = (bssids: string[]): string => {
  if (bssids.length === 0) return '#6b7280';
  if (bssids.length === 1) return macColor(bssids[0]);

  let sinSum = 0,
    cosSum = 0,
    sSum = 0,
    lSum = 0,
    count = 0;
  for (const bssid of bssids) {
    const hsl = parseHsl(macColor(bssid));
    if (!hsl) continue;
    const rad = (hsl.h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
    sSum += hsl.s;
    lSum += hsl.l;
    count++;
  }
  if (count === 0) return '#6b7280';
  const avgHue = ((Math.atan2(sinSum / count, cosSum / count) * 180) / Math.PI + 360) % 360;
  return `hsl(${Math.round(avgHue)}, ${Math.round(sSum / count)}%, ${Math.round(lSum / count)}%)`;
};

/**
 * Calculate dominant color for a cluster of BSSIDs
 * @param bssids - Array of MAC addresses
 * @returns HSL color string representing the cluster
 */
export const dominantClusterColor = (bssids: string[]): string => {
  if (bssids.length === 0) return '#38bdf8';

  const buckets = new Map<number, { count: number; sTotal: number; lTotal: number }>();

  bssids.forEach((bssid) => {
    const hsl = parseHsl(macColor(bssid));
    if (!hsl) return;

    const hueBucket = hsl.h;
    const existing = buckets.get(hueBucket);

    if (existing) {
      existing.count += 1;
      existing.sTotal += hsl.s;
      existing.lTotal += hsl.l;
    } else {
      buckets.set(hueBucket, { count: 1, sTotal: hsl.s, lTotal: hsl.l });
    }
  });

  if (buckets.size === 0) return '#38bdf8';

  let bestHue = 0;
  let best = { count: 0, sTotal: 0, lTotal: 0 };

  buckets.forEach((entry, hue) => {
    if (entry.count > best.count) {
      bestHue = hue;
      best = entry;
    }
  });

  const avgS = Math.round(best.sTotal / best.count);
  const avgL = Math.round(best.lTotal / best.count);

  return `hsl(${bestHue}, ${avgS}%, ${avgL}%)`;
};
