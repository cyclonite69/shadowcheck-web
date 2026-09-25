/**
 * vendor-docs-extract.ts
 *
 * Extracts clean article content from raw scraped vendor HTML files using
 * @mozilla/readability + jsdom. Outputs ShadowCheck-themed HTML to extracted/.
 *
 * Usage: npx ts-node scripts/vendor-docs-extract.ts
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const INPUT_DIR = path.resolve(__dirname, '../docs/references/vendor_docs');
const OUTPUT_DIR = path.join(INPUT_DIR, 'extracted');

// ─── Source type inference ─────────────────────────────────────────────────

type SourceType = 'leaked' | 'foia' | 'manufacturer' | 'public' | 'research';

const SOURCE_COLORS: Record<SourceType, string> = {
  leaked: '#dc2626',
  foia: '#f59e0b',
  manufacturer: '#6b7280',
  public: '#3b82f6',
  research: '#8b5cf6',
};

const SOURCE_LABELS: Record<SourceType, string> = {
  leaked: 'LEAKED',
  foia: 'FOIA',
  manufacturer: 'MANUFACTURER',
  public: 'PUBLIC',
  research: 'RESEARCH',
};

const PREFIX_MAP: Array<[string, SourceType]> = [
  ['l3harris_stingray', 'leaked'],
  ['l3harris_kingfish_aclu', 'foia'],
  ['l3harris_rochester_pricelist_muckrock', 'foia'],
  ['l3harris_', 'leaked'],
  ['septier_', 'research'],
  ['rohde_', 'manufacturer'],
  ['ubiquiti_', 'manufacturer'],
  ['cambium_', 'manufacturer'],
  ['peplink_', 'manufacturer'],
  ['northrop_', 'research'],
  ['gd_', 'research'],
  ['gdit_', 'research'],
  ['verint_', 'research'],
  ['norsat_', 'manufacturer'],
  ['leonardo_', 'manufacturer'],
  ['cobham_', 'manufacturer'],
  ['sii_', 'public'],
];

function inferSourceType(filename: string): SourceType {
  const lower = filename.toLowerCase();
  for (const [prefix, type] of PREFIX_MAP) {
    if (lower.startsWith(prefix)) {
      return type;
    }
  }
  return 'public';
}

// ─── Quality check ────────────────────────────────────────────────────────

const BLOCKED_STRINGS = [
  'page not found',
  'access denied',
  'enable javascript',
  '403 forbidden',
  'captcha',
  'verify you are human',
  'client challenge',
  'just a moment',
];

function qualityCheck(content: string): { words: number; blocked: boolean; sparse: boolean } {
  const text = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const words = text.trim().split(' ').filter(Boolean).length;
  const blocked = BLOCKED_STRINGS.some((s) => text.includes(s));
  return { words, blocked, sparse: words < 200 };
}

// ─── CSS & template ───────────────────────────────────────────────────────

const WRAPPER_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #0a1424;
    color: #f8fafc;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.7;
  }
  .sc-page {
    max-width: 780px;
    margin: 0 auto;
    padding: 28px 24px 64px;
  }
  .sc-card {
    background: rgba(15,23,42,0.8);
    border: 1px solid rgba(51,65,85,0.4);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .sc-card-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(30,41,59,0.6);
    background: linear-gradient(to right, rgba(15,23,42,0.8), rgba(15,23,42,0.4));
  }
  .sc-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .sc-title {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1.3;
  }
  .sc-meta {
    margin: 0;
    font-size: 11px;
    color: #94a3b8;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .sc-body {
    padding: 20px 24px 28px;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #e2e8f0;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.4em;
  }
  h1 { font-size: 1.3em; }
  h2 { font-size: 1.15em; }
  h3 { font-size: 1.05em; color: #94a3b8; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  p { margin: 0 0 0.9em; color: #e2e8f0; }
  img { max-width: 100%; height: auto; border-radius: 6px; opacity: 0.9; display: block; margin: 12px 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 13px; }
  th, td { border: 1px solid rgba(51,65,85,0.5); padding: 6px 10px; text-align: left; }
  th { background: rgba(30,41,59,0.6); color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  blockquote { border-left: 3px solid rgba(51,65,85,0.6); margin: 1em 0; padding: 0 0 0 16px; color: #94a3b8; font-style: italic; }
  code { background: rgba(30,41,59,0.6); border-radius: 4px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; padding: 1px 5px; color: #e2e8f0; }
  pre { background: rgba(30,41,59,0.6); border-radius: 6px; padding: 14px; overflow-x: auto; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; color: #e2e8f0; }
  hr { border: none; border-top: 1px solid rgba(51,65,85,0.4); margin: 1.5em 0; }
  ul, ol { padding-left: 1.4em; color: #e2e8f0; }
  li { margin-bottom: 0.3em; }
`.trim();

function wrapContent(opts: {
  title: string;
  byline: string | null;
  content: string;
  sourceType: SourceType;
  filename: string;
}): string {
  const { title, byline, content, sourceType, filename } = opts;
  const color = SOURCE_COLORS[sourceType];
  const label = SOURCE_LABELS[sourceType];
  const bylineHtml = byline ? `<p class="sc-meta" style="margin-top:4px">${byline}</p>` : '';
  const filenameHtml = `<p class="sc-meta" style="margin-top:2px;opacity:0.5">${filename}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${WRAPPER_CSS}</style>
</head>
<body>
<div class="sc-page">
  <div class="sc-card">
    <div class="sc-card-header">
      <span class="sc-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${label}</span>
      <h1 class="sc-title">${title}</h1>
      ${bylineHtml}
      ${filenameHtml}
    </div>
    <div class="sc-body">
      ${content}
    </div>
  </div>
</div>
</body>
</html>`;
}

function stubContent(filename: string, reason: string, sourceType: SourceType): string {
  const color = SOURCE_COLORS[sourceType];
  const label = SOURCE_LABELS[sourceType];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Extraction Failed — ${filename}</title>
<style>${WRAPPER_CSS}</style>
</head>
<body>
<div class="sc-page">
  <div class="sc-card">
    <div class="sc-card-header">
      <span class="sc-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${label}</span>
      <h1 class="sc-title" style="color:#f87171">Extraction Failed</h1>
      <p class="sc-meta">${filename}</p>
    </div>
    <div class="sc-body">
      <p style="color:#94a3b8">Content could not be extracted: <strong style="color:#e2e8f0">${reason}</strong></p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface FileResult {
  file: string;
  status: 'OK' | 'STUB';
  reason?: string;
  words: number;
  sourceType: SourceType;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.html'));
  console.log(`Processing ${files.length} HTML files...\n`);

  const results: FileResult[] = [];

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    const sourceType = inferSourceType(file);

    try {
      const html = fs.readFileSync(inputPath, 'utf-8');
      const dom = new JSDOM(html, { url: 'https://example.com' });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.content) {
        const reason = 'Readability returned null';
        fs.writeFileSync(outputPath, stubContent(file, reason, sourceType), 'utf-8');
        results.push({ file, status: 'STUB', reason, words: 0, sourceType });
        continue;
      }

      const { words, blocked, sparse } = qualityCheck(article.content);

      if (blocked) {
        const reason = 'BLOCKED — bot wall or error page detected';
        fs.writeFileSync(outputPath, stubContent(file, reason, sourceType), 'utf-8');
        results.push({ file, status: 'STUB', reason, words, sourceType });
        continue;
      }

      if (sparse) {
        const reason = `SPARSE — only ${words} words extracted`;
        fs.writeFileSync(outputPath, stubContent(file, reason, sourceType), 'utf-8');
        results.push({ file, status: 'STUB', reason, words, sourceType });
        continue;
      }

      const out = wrapContent({
        title: article.title || file,
        byline: article.byline ?? null,
        content: article.content,
        sourceType,
        filename: file,
      });
      fs.writeFileSync(outputPath, out, 'utf-8');
      results.push({ file, status: 'OK', words, sourceType });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      fs.writeFileSync(outputPath, stubContent(file, reason, sourceType), 'utf-8');
      results.push({ file, status: 'STUB', reason, words: 0, sourceType });
    }
  }

  // ─── Report ──────────────────────────────────────────────────────────────
  console.log(`${'FILE'.padEnd(55)} ${'STATUS'.padEnd(6)} ${'WORDS'.padEnd(7)} SOURCE_TYPE`);
  console.log('─'.repeat(90));
  for (const r of results) {
    const words = r.words.toString().padEnd(7);
    const status = r.status.padEnd(6);
    const note = r.reason ? `  ← ${r.reason}` : '';
    console.log(`${r.file.padEnd(55)} ${status} ${words} ${r.sourceType}${note}`);
  }

  const ok = results.filter((r) => r.status === 'OK').length;
  const stub = results.filter((r) => r.status === 'STUB').length;
  console.log(`\nDone: ${ok} OK, ${stub} stubs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
