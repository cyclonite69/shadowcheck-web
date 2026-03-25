#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import logger from '../server/src/logging/logger';

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

logger.info(
  `[write-robots] Generated robots.txt (indexing: ${allowIndexing ? 'ALLOWED' : 'DISALLOWED'})`
);
logger.info(`[write-robots] Output: ${outputPath}`);
