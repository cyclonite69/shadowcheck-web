#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const allowIndexing = process.env.ALLOW_INDEXING === 'true' || isProduction;

const robotsTxt = allowIndexing
  ? `User-agent: *
Allow: /

Sitemap: ${process.env.SITE_URL || 'https://yoursite.com'}/sitemap.xml`
  : `User-agent: *
Disallow: /`;

const outputPath = path.join(__dirname, '../client/public/robots.txt');
fs.writeFileSync(outputPath, robotsTxt);

console.log(
  `[write-robots] Generated robots.txt (indexing: ${allowIndexing ? 'ALLOWED' : 'DISALLOWED'})`
);
console.log(`[write-robots] Output: ${outputPath}`);
