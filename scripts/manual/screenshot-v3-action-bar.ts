/**
 * One-off screenshot script: captures the V3 import tab action bar
 * (count label + Refresh List + Columns buttons) for layout verification.
 *
 * Usage:
 *   E2E_ADMIN_PASSWORD=<password> TS_NODE_PROJECT=tsconfig.server.json \
 *     npx ts-node scripts/manual/screenshot-v3-action-bar.ts
 *
 * Output: /tmp/v3-action-bar.png
 */

import { chromium, type BrowserContext } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3001';
const USERNAME = process.env.E2E_ADMIN_USER ?? 'admin';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

function redactCookieValue(header: string): string {
  return header.replace(/^([^=]+)=([^;]*)/, '$1=[REDACTED]');
}

function redactCookies(cookies: Awaited<ReturnType<BrowserContext['cookies']>>): string {
  return JSON.stringify(
    cookies.map(({ value, ...cookie }) => ({
      ...cookie,
      value: value ? '[REDACTED]' : value,
    })),
    null,
    2
  );
}

async function contextCookies(
  context: BrowserContext
): Promise<Awaited<ReturnType<BrowserContext['cookies']>>> {
  return context.cookies();
}

if (!PASSWORD) {
  console.error('E2E_ADMIN_PASSWORD is required');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    console.log(`[browser console] ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    console.log(`[browser error] ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() < 200 || response.status() >= 300) {
      console.log(
        `[browser response] ${response.status()} ${response.request().method()} ${response.url()}`
      );
    }
  });

  // Log in via the API directly
  const loginRes = await context.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  if (!loginRes.ok()) {
    console.error('Login failed:', loginRes.status(), await loginRes.text());
    await browser.close();
    process.exit(1);
  }
  console.log(
    'Login Set-Cookie headers (values redacted):',
    loginRes
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === 'set-cookie')
      .map(({ value }) => redactCookieValue(value))
  );
  console.log(
    'Cookies after login (values redacted):',
    redactCookies(await contextCookies(context))
  );

  // Navigate to admin page and switch to the V3 import tab
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(8000);
  console.log(
    'Cookies after /admin navigation (values redacted):',
    redactCookies(await contextCookies(context))
  );
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
    console.warn('Admin page did not reach load state within timeout — continuing');
  });

  // Open the WiGLE Detail (v3) tab that contains the batch enrichment table.
  const tab = page.getByRole('button', { name: 'WiGLE Detail (v3)' });
  if (await tab.count()) {
    await tab.click();
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
      console.warn('V3 tab did not reach load state within timeout — continuing');
    });
  } else {
    console.warn('Could not find V3 tab by role — taking full-page screenshot instead');
  }

  const targetedSelection = page.getByLabel('Targeted Selection Mode (Select from Catalog)');
  if (await targetedSelection.count()) {
    await targetedSelection.check();
  } else {
    console.warn('Could not find Targeted Selection Mode control');
  }

  // Wait for the action bar to appear
  await page.waitForSelector('text=Networks Found', { timeout: 10000 }).catch(() => {
    console.warn('Action bar not found within timeout — page may still be loading');
  });

  // Screenshot the action bar region specifically
  const actionBar = page.locator('text=Networks Found').locator('../..');
  if (await actionBar.count()) {
    await actionBar.screenshot({ path: '/tmp/v3-action-bar.png' });
    console.log('Action bar screenshot saved to /tmp/v3-action-bar.png');
  } else {
    // Fall back to full page
    await page.screenshot({ path: '/tmp/v3-action-bar-fullpage.png', fullPage: false });
    console.log('Full-page screenshot saved to /tmp/v3-action-bar-fullpage.png');
  }

  await browser.close();
})();
