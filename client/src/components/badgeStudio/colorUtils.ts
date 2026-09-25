/**
 * Pure color math utilities for Badge Studio.
 * Zero React dependencies — fully unit-testable.
 */

import type { BadgeColor, BadgeFill } from '../../types/badgeConfig';

export interface ResolvedBadgeColors {
  text: string;
  background: string;
  border: string;
}

/** Parse a 3 or 6-digit hex string to { r, g, b } (0-255). Returns null for invalid input. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/** Convert hex color to HSL. Returns { h: 0-360, s: 0-100, l: 0-100 }. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return { h: 0, s: 0, l: 0 };
  }
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Convert HSL to hex string. h: 0-360, s: 0-100, l: 0-100. */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns '#ffffff' or '#000000' based on W3C relative luminance of the hex color.
 * Uses 4.5:1 contrast ratio threshold.
 */
export function autoContrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return '#ffffff';
  }
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  return L > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Converts a hex color to an rgba() string with the given alpha (0-1).
 * Falls back to 'transparent' for invalid hex.
 */
export function hexWithOpacity(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 'transparent';
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Resolves a BadgeColor + fill mode into concrete CSS color strings.
 * All smart defaults are applied here; BadgeRenderer is a dumb consumer.
 */
export function resolveBadgeColors(color: BadgeColor, fill: BadgeFill): ResolvedBadgeColors {
  const accent = color.accentColor;
  switch (fill) {
    case 'solid':
      return {
        text: color.textColor ?? autoContrastText(accent),
        background: color.backgroundColor ?? accent,
        border: color.borderColor ?? hexWithOpacity(accent, 0.6),
      };
    case 'outlined':
      return {
        text: color.textColor ?? accent,
        background: color.backgroundColor ?? 'transparent',
        border: color.borderColor ?? hexWithOpacity(accent, 0.7),
      };
    case 'ghost':
      return {
        text: color.textColor ?? accent,
        background: color.backgroundColor ?? hexWithOpacity(accent, 0.15),
        border: color.borderColor ?? hexWithOpacity(accent, 0.25),
      };
    case 'text-only':
      return {
        text: color.textColor ?? accent,
        background: 'transparent',
        border: 'transparent',
      };
  }
}

/**
 * Evaluate a BadgeMatchRule against a raw cell value.
 * Returns true if the rule matches.
 */
export function matchesRule(
  match: import('../../types/badgeConfig').BadgeMatchRule,
  value: unknown
): boolean {
  switch (match.type) {
    case 'any':
      return true;
    case 'exact':
      return value === match.value || String(value) === String(match.value);
    case 'contains':
      return typeof value === 'string' && value.toLowerCase().includes(match.value.toLowerCase());
    case 'regex':
      try {
        return new RegExp(match.pattern, 'i').test(String(value ?? ''));
      } catch {
        return false;
      }
    case 'range': {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(n)) {
        return false;
      }
      if (match.min !== undefined && n < match.min) {
        return false;
      }
      if (match.max !== undefined && n > match.max) {
        return false;
      }
      return true;
    }
  }
}
