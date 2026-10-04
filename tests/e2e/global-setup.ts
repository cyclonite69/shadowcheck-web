/**
 * Playwright global setup — runs once before all tests.
 *
 * Logs in as admin and saves the browser storage state (cookies) to a file
 * so all test workers can reuse the session without re-authenticating.
 * This avoids hitting the auth rate limiter (429) when tests run in parallel.
 *
 * The saved state path must match `storageState` in playwright.config.ts.
 */

import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_STATE_PATH = path.join(__dirname, '.auth', 'state.json');

export default async function globalSetup() {
  // Ensure the .auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  const e2ePassword = process.env.E2E_ADMIN_PASSWORD;
  if (!e2ePassword) {
    await browser.close();
    throw new Error(
      'E2E_ADMIN_PASSWORD env var is required. See tests/e2e/README.md for setup instructions.'
    );
  }

  // Log in via the API
  const response = await context.request.post('http://127.0.0.1:3001/api/auth/login', {
    data: {
      username: process.env.E2E_ADMIN_USER ?? 'admin',
      password: e2ePassword,
    },
  });

  if (!response.ok()) {
    const status = response.status();
    const text = await response.text();
    await browser.close();
    throw new Error(`Global setup login failed: ${status} ${text}`);
  }

  const body = await response.json();
  if (!body.success) {
    await browser.close();
    throw new Error(`Global setup login rejected: ${JSON.stringify(body)}`);
  }

  // Plant the cookie into the context so storageState captures it
  const setCookie = response.headers()['set-cookie'];
  if (setCookie) {
    const match = setCookie.match(/([^=]+)=([^;]+)/);
    if (match) {
      const [, name, value] = match;
      await context.addCookies([{ name, value, domain: '127.0.0.1', path: '/' }]);
    }
  }

  // Optional non-admin user setup if E2E_USER_PASSWORD is provided
  const e2eUserPassword = process.env.E2E_USER_PASSWORD;
  if (e2eUserPassword) {
    const userContext = await browser.newContext();
    try {
      const userResponse = await userContext.request.post('http://127.0.0.1:3001/api/auth/login', {
        data: {
          username: process.env.E2E_USER_USER ?? 'user',
          password: e2eUserPassword,
        },
      });

      if (userResponse.ok()) {
        const userBody = await userResponse.json();
        if (userBody.success) {
          const userSetCookie = userResponse.headers()['set-cookie'];
          if (userSetCookie) {
            const match = userSetCookie.match(/([^=]+)=([^;]+)/);
            if (match) {
              const [, name, value] = match;
              await userContext.addCookies([{ name, value, domain: '127.0.0.1', path: '/' }]);
            }
          }
          await userContext.storageState({ path: path.join(__dirname, '.auth', 'user.json') });
        }
      }
    } finally {
      await userContext.close();
    }
  }

  // Save cookies + localStorage to disk — shared by all workers
  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
