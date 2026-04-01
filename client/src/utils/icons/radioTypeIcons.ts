/**
 * Radio Type SVG Icons for ShadowCheck
 * Used in tooltips and network displays
 * Supports: WiFi (W), Bluetooth/BLE (E), Cellular/LTE/NR (L), GSM (G), Stingray, Unknown
 */

export const RADIO_TYPE_ICONS: Record<string, string> = {
  WiFi: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.94 0"/><circle cx="12" cy="20" r="0.5" fill="currentColor"/></svg>`,

  Bluetooth: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>`,

  BLE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/><path d="M2 8h2M2 16h2M20 8h2M20 16h2" stroke-width="1.5" opacity="0.5"/></svg>`,

  Cellular: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`,

  LTE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`,

  NR: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-3"/><path d="M12 20v-7"/><path d="M17 20v-5"/><path d="M22 20V2"/></svg>`,

  GSM: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`,

  Stingray: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,

  Unknown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`,
};

/**
 * Get SVG icon for radio type with custom color
 * @param type - Radio type (WiFi, Bluetooth, BLE, Cellular, LTE, NR, GSM, Stingray, Unknown)
 * @param color - SVG stroke color (hex or rgb)
 * @returns SVG string with color applied
 */
export const getRadioTypeIcon = (type: string, color: string = '#fff'): string => {
  const icon = RADIO_TYPE_ICONS[type] || RADIO_TYPE_ICONS['Unknown'];
  // Replace currentColor with actual color
  return icon.replace(/currentColor/g, color);
};

/**
 * Determine display radio type from raw radio tech and capabilities
 * @param tech - Technical radio type (wifi_*, bt, ble, lte, nr, gsm, stingray, unknown)
 * @param isBT - Whether it's Bluetooth/BLE
 * @param isCellular - Whether it's Cellular
 * @param isStingray - Whether it's Stingray
 * @returns Display radio type for UI
 */
export const getDisplayRadioType = (
  tech: string,
  isBT: boolean,
  isCellular: boolean,
  isStingray: boolean
): string => {
  if (isStingray) return 'Stingray';
  if (isBT) return tech === 'ble' ? 'BLE' : 'Bluetooth';
  if (isCellular) {
    if (tech === 'nr') return 'NR';
    if (tech === 'gsm') return 'GSM';
    return 'Cellular';
  }
  return 'WiFi';
};
