const fs = require('fs');
const path = require('path');

const baseUrl = process.env.SITE_URL || 'https://yoursite.com';
const pages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/dashboard', priority: '0.9', changefreq: 'daily' },
  { url: '/geospatial', priority: '0.8', changefreq: 'weekly' },
  { url: '/geospatial-intel', priority: '0.8', changefreq: 'weekly' },
  { url: '/geospatial-explorer', priority: '0.8', changefreq: 'weekly' },
  { url: '/analytics', priority: '0.8', changefreq: 'weekly' },
  { url: '/wigle', priority: '0.6', changefreq: 'monthly' },
  { url: '/ml-training', priority: '0.6', changefreq: 'monthly' },
  { url: '/kepler', priority: '0.6', changefreq: 'monthly' },
  { url: '/endpoint-test', priority: '0.4', changefreq: 'monthly' },
  { url: '/admin', priority: '0.5', changefreq: 'monthly' },
];

const urlEntries = pages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

const outputPath = path.join(__dirname, '../client/public/sitemap.xml');
fs.writeFileSync(outputPath, sitemap);

console.log(`[generate-sitemap] Generated sitemap with ${pages.length} pages`);
console.log(`[generate-sitemap] Output: ${outputPath}`);
