#!/usr/bin/env tsx
/**
 * FBI Field Offices + Resident Agencies loader
 *
 * Sources:
 * - https://www.fbi.gov/contact-us/field-offices/field-offices
 * - https://www.fbi.gov/contact-us/field-offices/<office>/about
 */

import { createPool } from '../utils/db';

type OfficeType = 'field_office' | 'resident_agency';

// These entries show up on some field office pages under "Main Field Office Territory",
// but they are coverage/jurisdiction notes, not physical offices.
const PLACEHOLDER_NAMES = new Set([
  'Areas covered',
  'City covered',
  'Counties served',
  'Counties covered',
  'Counties and city covered',
  'Counties and cities covered',
  'Municipalities covered',
  'Parishes covered',
  'North',
  'South',
  'East',
  'West',
  'Iowa',
  'Nebraska',
]);

interface OfficeRecord {
  agency: string;
  officeType: OfficeType;
  name: string;
  parentOffice?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
  jurisdiction?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceUrl: string;
  sourceRetrievedAt: Date;
}

interface FieldOfficeIndexEntry {
  slug: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
  jurisdiction?: string | null;
}

const BASE_URL = 'https://www.fbi.gov';
const FIELD_OFFICES_URL = `${BASE_URL}/contact-us/field-offices/field-offices`;
const JINA_PREFIX = 'https://r.jina.ai/';
const USE_JINA = process.env.FBI_USE_JINA !== 'false';
const REQUEST_DELAY_MS = Number(process.env.FBI_REQUEST_DELAY_MS || '400');
const MAX_RETRIES = Number(process.env.FBI_MAX_RETRIES || '5');

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
  'puerto rico': 'PR',
  guam: 'GU',
  'u.s. virgin islands': 'VI',
  'us virgin islands': 'VI',
  'american samoa': 'AS',
  'northern mariana islands': 'MP',
};

const SECTION_STOP_KEYWORDS = ['leadership', 'history', 'news', 'press', 'contact us', 'follow us'];

const PHONE_REGEX = /\(?\d{3}\)?[^\d]?\d{3}[^\d]?\d{4}/;
const CITY_STATE_ZIP_REGEX = /^(.*?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/;

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&hellip;/gi, '...');
}

function htmlToLines(html: string): string[] {
  const cleaned = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>(?=\s*<)/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/section>|<\/li>|<\/h\d>|<\/tr>|<\/td>|<\/th>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  return cleaned.split(/\r?\n/).map(normalizeLine).filter(Boolean);
}

function textToLines(raw: string): string[] {
  const marker = 'Markdown Content:';
  let content = raw;
  if (raw.includes(marker)) {
    content = raw.split(marker).slice(1).join(marker);
  }

  if (/<[^>]+>/.test(content)) {
    return htmlToLines(content);
  }

  return content.split(/\r?\n/).map(normalizeLine).filter(Boolean);
}

function stripBullet(line: string): string {
  return line.replace(/^[\-\*•\u2022\u00b7]+\s*/, '').trim();
}

function stripMarkdown(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_+/g, '')
    .trim();
}

function isStopLine(line: string, stopKeywords: string[]): boolean {
  const lower = line.toLowerCase();
  return stopKeywords.some((keyword) => lower.includes(keyword));
}

function normalizeStateKey(line: string): string {
  return line.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function resolveStateAbbr(line: string): string | null {
  const key = normalizeStateKey(line);
  if (STATE_NAME_TO_ABBR[key]) {
    return STATE_NAME_TO_ABBR[key];
  }
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) {
    return key.toUpperCase();
  }
  return null;
}

function extractMarkdownLink(line: string): { text: string; url: string } | null {
  const match = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (!match) return null;
  return { text: match[1], url: match[2] };
}

function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/\/contact-us\/field-offices\/([a-z0-9-]+)/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

function titleizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => {
      if (part === 'st') return 'St.';
      if (part === 'ft') return 'Ft.';
      return part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`;
    })
    .join(' ');
}

function parseCityStateZip(line: string): {
  city: string | null;
  state: string | null;
  postalCode: string | null;
} {
  const match = line.match(CITY_STATE_ZIP_REGEX);
  if (!match) return { city: null, state: null, postalCode: null };
  return { city: match[1], state: match[2], postalCode: match[3] };
}

function extractPhone(lines: string[]): string | null {
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
}

function extractAddress(lines: string[]): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
} {
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const clean = stripMarkdown(raw);
    if (!clean.toLowerCase().startsWith('address')) continue;

    const inlineMatch = clean.match(/address\s*:?\s*(.+)/i);
    const collected: string[] = [];

    if (inlineMatch && inlineMatch[1]) {
      collected.push(inlineMatch[1].trim());
    }

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = stripMarkdown(lines[j]);
      if (!line) continue;
      if (isStopLine(line, SECTION_STOP_KEYWORDS)) break;
      collected.push(line);
      if (collected.length >= 4) break;
    }

    if (collected.length === 0) {
      return { addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null };
    }

    let cityLine = collected.find((line) => CITY_STATE_ZIP_REGEX.test(line));
    const addressLines = collected.filter((line) => line !== cityLine);

    if (!cityLine && collected.length >= 2) {
      cityLine = collected[collected.length - 1];
    }

    const { city, state, postalCode } = cityLine
      ? parseCityStateZip(cityLine)
      : {
          city: null,
          state: null,
          postalCode: null,
        };

    return {
      addressLine1: addressLines[0] || null,
      addressLine2: addressLines.length > 1 ? addressLines.slice(1).join(', ') : null,
      city,
      state,
      postalCode,
    };
  }

  return { addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null };
}

function extractJurisdiction(lines: string[]): string | null {
  for (const raw of lines) {
    const clean = stripMarkdown(raw);
    if (clean.toLowerCase().startsWith('covers ')) {
      return clean;
    }
  }
  return null;
}

function extractResidentAgencies(
  lines: string[],
  parentOffice: string,
  sourceUrl: string
): OfficeRecord[] {
  const headerIndex = lines.findIndex((line) =>
    line.toLowerCase().includes('main field office territory')
  );

  if (headerIndex < 0) return [];

  const agencies: OfficeRecord[] = [];
  let currentState: string | null = null;

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const cleanLine = stripMarkdown(stripBullet(rawLine));
    if (!cleanLine) continue;

    if (isStopLine(cleanLine, SECTION_STOP_KEYWORDS)) break;
    if (cleanLine.toLowerCase().startsWith('leadership')) break;
    if (cleanLine.toLowerCase().startsWith('along with our main office')) continue;
    if (cleanLine.toLowerCase().includes('counties covered')) continue;
    if (cleanLine.toLowerCase().includes('county covered')) continue;

    const stateAbbr = resolveStateAbbr(cleanLine);
    if (stateAbbr && !cleanLine.includes(':')) {
      currentState = stateAbbr;
      continue;
    }

    if (!cleanLine.includes(':')) {
      continue;
    }

    const parts = cleanLine.split(':');
    const name = normalizeLine(parts[0]);
    const jurisdiction = normalizeLine(parts.slice(1).join(':')) || null;

    if (!name) continue;

    // These are coverage/jurisdiction notes, not physical offices.
    // They should live under the field office as metadata (handled separately).
    if (PLACEHOLDER_NAMES.has(name)) {
      continue;
    }

    agencies.push({
      agency: 'FBI',
      officeType: 'resident_agency',
      name,
      parentOffice,
      addressLine1: null,
      addressLine2: null,
      city: name,
      state: currentState,
      postalCode: null,
      phone: null,
      website: null,
      jurisdiction,
      latitude: null,
      longitude: null,
      sourceUrl,
      sourceRetrievedAt: new Date(),
    });
  }

  return agencies;
}

function extractFieldOfficeSlugs(raw: string): string[] {
  const slugRegex = /\/contact-us\/field-offices\/([a-z0-9-]+)/gi;
  const slugs = new Set<string>();
  let match = slugRegex.exec(raw);
  while (match) {
    const slug = match[1];
    if (slug && slug !== 'field-offices') {
      slugs.add(slug.toLowerCase());
    }
    match = slugRegex.exec(raw);
  }
  return Array.from(slugs).sort();
}

function parseFieldOfficeIndex(raw: string): Map<string, FieldOfficeIndexEntry> {
  const lines = textToLines(raw);
  const index = new Map<string, FieldOfficeIndexEntry>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('###')) continue;
    if (!line.includes('/contact-us/field-offices/')) continue;

    const link = extractMarkdownLink(line);
    const slug = extractSlugFromUrl(link?.url ?? line);
    if (!slug || slug === 'field-offices') continue;

    const name = stripMarkdown(link?.text ?? titleizeSlug(slug));
    const blockLines: string[] = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      const nextLine = lines[j];
      if (nextLine.startsWith('###')) break;
      blockLines.push(nextLine);
    }

    let addressLines: string[] = [];
    let cityLine: string | null = null;
    let phone: string | null = null;
    let jurisdiction: string | null = null;

    for (const rawBlockLine of blockLines) {
      const clean = stripMarkdown(rawBlockLine);
      if (!clean) continue;
      if (clean.startsWith('Image') || clean.startsWith('Results:')) continue;
      if (clean.startsWith('Sort by')) continue;

      const phoneMatch = clean.match(PHONE_REGEX);
      if (phoneMatch) {
        phone = phoneMatch[0];
        continue;
      }

      if (clean.toLowerCase().startsWith('covers ')) {
        jurisdiction = clean;
        continue;
      }

      if (CITY_STATE_ZIP_REGEX.test(clean)) {
        cityLine = clean;
        continue;
      }

      if (clean.includes('/contact-us/field-offices/')) {
        continue;
      }

      addressLines.push(clean);
    }

    if (addressLines.length === 0) {
      addressLines = [];
    }

    const { city, state, postalCode } = cityLine
      ? parseCityStateZip(cityLine)
      : {
          city: null,
          state: null,
          postalCode: null,
        };

    index.set(slug, {
      slug,
      name,
      addressLine1: addressLines[0] || null,
      addressLine2: addressLines.length > 1 ? addressLines.slice(1).join(', ') : null,
      city,
      state,
      postalCode,
      phone,
      website: `${BASE_URL}/contact-us/field-offices/${slug}`,
      jurisdiction,
    });
  }

  return index;
}

async function fetchText(url: string, attempt = 0): Promise<string> {
  const targetUrl = USE_JINA && url.startsWith('https://') ? `${JINA_PREFIX}${url}` : url;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (response.ok) {
    return response.text();
  }

  if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    const baseDelay = response.status === 429 ? 15000 : 2000;
    const backoff = Math.min(
      60000,
      (retryAfter > 0 ? retryAfter * 1000 : baseDelay) * 2 ** attempt
    );
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return fetchText(url, attempt + 1);
  }

  throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
}

async function upsertOffice(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  record: OfficeRecord
): Promise<void> {
  const sql = `
    INSERT INTO app.agency_offices (
      agency,
      office_type,
      name,
      parent_office,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      phone,
      website,
      jurisdiction,
      latitude,
      longitude,
      location,
      source_url,
      source_retrieved_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      CASE
        WHEN $13::double precision IS NULL OR $14::double precision IS NULL THEN NULL::geography
        ELSE ST_SetSRID(ST_MakePoint($14::double precision, $13::double precision), 4326)::geography
      END,
      $15, $16, NOW()
    )
    ON CONFLICT (agency, office_type, name, city, state)
    DO UPDATE SET
      parent_office = EXCLUDED.parent_office,
      address_line1 = EXCLUDED.address_line1,
      address_line2 = EXCLUDED.address_line2,
      postal_code = EXCLUDED.postal_code,
      phone = EXCLUDED.phone,
      website = EXCLUDED.website,
      jurisdiction = EXCLUDED.jurisdiction,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      location = EXCLUDED.location,
      source_url = EXCLUDED.source_url,
      source_retrieved_at = EXCLUDED.source_retrieved_at,
      updated_at = NOW();
  `;

  await client.query(sql, [
    record.agency,
    record.officeType,
    record.name,
    record.parentOffice ?? null,
    record.addressLine1 ?? null,
    record.addressLine2 ?? null,
    record.city ?? null,
    record.state ?? null,
    record.postalCode ?? null,
    record.phone ?? null,
    record.website ?? null,
    record.jurisdiction ?? null,
    record.latitude ?? null,
    record.longitude ?? null,
    record.sourceUrl,
    record.sourceRetrievedAt,
  ]);
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  const fieldOfficeRaw = await fetchText(FIELD_OFFICES_URL);
  const officeIndex = parseFieldOfficeIndex(fieldOfficeRaw);
  const slugs = officeIndex.size
    ? Array.from(officeIndex.keys()).sort()
    : extractFieldOfficeSlugs(fieldOfficeRaw);
  const officeSlugs = limit ? slugs.slice(0, limit) : slugs;

  if (officeSlugs.length === 0) {
    throw new Error('No field office slugs found.');
  }

  const pool = createPool();
  const client = await pool.connect();

  let inserted = 0;
  let residentAgencyCount = 0;

  try {
    await client.query('BEGIN');

    if (refresh) {
      await client.query('DELETE FROM app.agency_offices WHERE agency = $1', ['FBI']);
    }

    for (const slug of officeSlugs) {
      const officeUrl = `${BASE_URL}/contact-us/field-offices/${slug}`;
      const aboutUrl = `${officeUrl}/about`;
      const aboutRaw = await fetchText(aboutUrl);
      const aboutLines = textToLines(aboutRaw);

      const indexEntry = officeIndex.get(slug);
      const name = indexEntry?.name ?? titleizeSlug(slug);
      const phone = indexEntry?.phone ?? extractPhone(aboutLines);
      const address = indexEntry
        ? {
            addressLine1: indexEntry.addressLine1 ?? null,
            addressLine2: indexEntry.addressLine2 ?? null,
            city: indexEntry.city ?? null,
            state: indexEntry.state ?? null,
            postalCode: indexEntry.postalCode ?? null,
          }
        : extractAddress(aboutLines);
      const jurisdiction = indexEntry?.jurisdiction ?? extractJurisdiction(aboutLines);

      const fieldOffice: OfficeRecord = {
        agency: 'FBI',
        officeType: 'field_office',
        name,
        parentOffice: null,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        phone,
        website: indexEntry?.website ?? officeUrl,
        jurisdiction,
        latitude: null,
        longitude: null,
        sourceUrl: aboutUrl,
        sourceRetrievedAt: new Date(),
      };

      await upsertOffice(client, fieldOffice);
      inserted += 1;

      const residentAgencies = extractResidentAgencies(aboutLines, name, aboutUrl);
      for (const agency of residentAgencies) {
        await upsertOffice(client, agency);
        residentAgencyCount += 1;
      }

      if (REQUEST_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Loaded ${inserted} field offices.`);
  console.log(`Loaded ${residentAgencyCount} resident agencies.`);

  // Also load training facilities if a CSV is provided or available
  const csvPath =
    process.argv.find((arg) => arg.startsWith('--csv='))?.split('=')[1] ||
    path.join(__dirname, '..', '..', 'data', 'csv', 'fbi_training_facilities.csv');
  if (fs.existsSync(csvPath)) {
    console.log(`Loading training facilities from ${csvPath}...`);
    const records = loadCsv(csvPath);
    let tfUpdated = 0;
    let tfInserted = 0;

    try {
      await client.query('BEGIN');
      for (const record of records) {
        const result = await upsertTrainingFacility(client, record);
        if (result === 'updated') tfUpdated += 1;
        else tfInserted += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to load training facilities:', error);
    }

    console.log(`Training facilities: Updated ${tfUpdated}, Inserted ${tfInserted}`);
  }
}

// --- Training Facilities Logic ---
interface TrainingFacilityRecord {
  name: string;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string;
  sourceRetrievedAt: Date;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function loadCsv(filePath: string): TrainingFacilityRecord[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((col) => col.toLowerCase());
  const rows: TrainingFacilityRecord[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cols[idx] ?? '';
    });

    rows.push({
      name: row.name,
      city: row.city || null,
      state: row.state || null,
      addressLine1: row.address_line1 || null,
      addressLine2: row.address_line2 || null,
      postalCode: row.postal_code || null,
      phone: row.phone || null,
      website: row.website || null,
      sourceUrl: row.source_url,
      sourceRetrievedAt: row.source_retrieved_at ? new Date(row.source_retrieved_at) : new Date(),
    });
  }
  return rows;
}

async function upsertTrainingFacility(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }> },
  record: TrainingFacilityRecord
): Promise<'updated' | 'inserted'> {
  const updateSql = `
    UPDATE app.agency_offices
    SET address_line1 = COALESCE($4::text, address_line1), address_line2 = COALESCE($5::text, address_line2),
        city = COALESCE($2::text, city), state = COALESCE($3::text, state), postal_code = COALESCE($6::text, postal_code),
        phone = COALESCE($7::text, phone), website = COALESCE($8::text, website), source_url = $9::text,
        source_retrieved_at = $10::timestamp, source_status = 'verified', updated_at = NOW()
    WHERE agency = 'FBI' AND office_type = 'training_facility' AND name = $1::text
      AND ($2::text IS NULL OR city = $2::text OR city IS NULL)
      AND ($3::text IS NULL OR state = $3::text OR state IS NULL)
  `;

  const updateResult = await client.query(updateSql, [
    record.name,
    record.city,
    record.state,
    record.addressLine1,
    record.addressLine2,
    record.postalCode,
    record.phone,
    record.website,
    record.sourceUrl,
    record.sourceRetrievedAt,
  ]);

  if (updateResult.rowCount > 0) return 'updated';

  const insertSql = `
    INSERT INTO app.agency_offices (agency, office_type, name, address_line1, address_line2, city, state, postal_code, phone, website, source_url, source_retrieved_at, source_status, updated_at)
    VALUES ('FBI', 'training_facility', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'verified', NOW())
  `;

  await client.query(insertSql, [
    record.name,
    record.addressLine1,
    record.addressLine2,
    record.city,
    record.state,
    record.postalCode,
    record.phone,
    record.website,
    record.sourceUrl,
    record.sourceRetrievedAt,
  ]);

  return 'inserted';
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
