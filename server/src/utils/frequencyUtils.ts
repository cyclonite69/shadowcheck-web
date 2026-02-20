/**
 * Shared frequency/channel conversion utilities.
 * Used by kepler route and any future server-side consumers.
 */

/**
 * Calculate WiFi channel number from frequency in MHz.
 * Supports 2.4 GHz (ch 1–14), 5 GHz, and 6 GHz (WiFi 6E) bands.
 */
export function frequencyToChannel(freqMhz: number | null | undefined): number | null {
  if (!freqMhz) return null;
  // 2.4 GHz band (channels 1–14)
  if (freqMhz >= 2412 && freqMhz <= 2484) {
    if (freqMhz === 2484) return 14; // Japan only
    return Math.round((freqMhz - 2407) / 5);
  }
  // 5 GHz band
  if (freqMhz >= 5170 && freqMhz <= 5825) {
    return Math.round((freqMhz - 5000) / 5);
  }
  // 6 GHz band (WiFi 6E)
  if (freqMhz >= 5935 && freqMhz <= 7115) {
    return Math.round((freqMhz - 5950) / 5) + 1;
  }
  return null;
}
