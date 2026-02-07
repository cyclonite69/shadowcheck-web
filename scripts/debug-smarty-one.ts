#!/usr/bin/env tsx
/**
 * Debug helper: query Smarty US Street API for a single address and print the response.
 *
 * Usage:
 *   npx --yes tsx scripts/debug-smarty-one.ts --street="2508 Bluecutt Rd" --city="Columbus" --state="MS" --zip="39705"
 *
 * Notes:
 * - Reads Smarty creds from keyring via server secretsManager, falling back to env vars.
 * - Does not print auth-id/auth-token.
 */

import * as dotenv from 'dotenv';

dotenv.config();

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

function getArg(argv: string[], prefix: string): string | null {
  const raw = argv.find((a) => a.startsWith(prefix));
  if (!raw) return null;
  const v = raw.slice(prefix.length).trim();
  return v.length ? v : null;
}

async function loadSecretsManager(): Promise<SecretsManager> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sm = require('../server/src/services/secretsManager') as SecretsManager;
  if (!sm?.getSecret) throw new Error('Failed to load secretsManager (missing getSecret).');
  return sm;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const street = getArg(argv, '--street=');
  const city = getArg(argv, '--city=');
  const state = getArg(argv, '--state=');
  const zip = getArg(argv, '--zip=');

  if (!street || !city || !state) {
    throw new Error('Missing required args: --street=, --city=, --state= (optional: --zip=)');
  }

  const secrets = await loadSecretsManager();
  const authId = (await secrets.getSecret('smarty_auth_id')) || process.env.SMARTY_AUTH_ID;
  const authToken = (await secrets.getSecret('smarty_auth_token')) || process.env.SMARTY_AUTH_TOKEN;
  if (!authId || !authToken) throw new Error('Smarty creds not configured.');

  const url = new URL('https://us-street.api.smarty.com/street-address');
  url.searchParams.set('auth-id', authId);
  url.searchParams.set('auth-token', authToken);

  const payload: Record<string, unknown> = {
    input_id: 'debug',
    street,
    city,
    state,
    candidates: 3,
  };
  if (zip) payload.zipcode = zip;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([payload]),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Smarty HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  // Pretty-print JSON (small payload).
  try {
    const json = JSON.parse(text);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  } catch {
    // eslint-disable-next-line no-console
    console.log(text);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(String(e?.stack || e));
  process.exit(1);
});
