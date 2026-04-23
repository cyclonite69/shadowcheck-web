import { OfficeRecord } from './types';

const PHONE_REGEX = /(\(\d{3}\)\s*|\d{3}-)\d{3}-\d{4}/;
const CITY_STATE_ZIP_REGEX = /([A-Za-z\s]+),\s*([A-Za-z]{2})\s*(\d{5}(-\d{4})?)/;
const SECTION_STOP_KEYWORDS = ['address', 'phone', 'website', 'jurisdiction', 'field offices'];

export const stripMarkdown = (s: string): string => s.replace(/[*_#\[\]()]/g, '');

export const isStopLine = (line: string, stopKeywords: string[]): boolean => {
  const lower = line.toLowerCase();
  return stopKeywords.some((keyword) => lower.includes(keyword));
};

export const normalizeStateKey = (line: string): string =>
  line.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

export const parseCityStateZip = (
  line: string
): {
  city: string | null;
  state: string | null;
  postalCode: string | null;
} => {
  const match = line.match(CITY_STATE_ZIP_REGEX);
  if (!match) return { city: null, state: null, postalCode: null };
  return { city: match[1], state: match[2], postalCode: match[3] };
};

export const extractPhone = (lines: string[]): string | null => {
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const clean = stripMarkdown(raw);
    const inlineMatch = clean.match(PHONE_REGEX);
    if (inlineMatch && clean.toLowerCase().includes('phone')) {
      return inlineMatch[0];
    }

    if (clean.toLowerCase() === 'phone' || clean.toLowerCase() === '**phone**') {
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = stripMarkdown(lines[j]);
        const match = next.match(PHONE_REGEX);
        if (match) return match[0];
        if (isStopLine(next, SECTION_STOP_KEYWORDS)) break;
      }
    }
  }
  return null;
};
