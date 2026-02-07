#!/usr/bin/env tsx
/**
 * Quick sanity check for Smarty US Street API credentials.
 *
 * This does not touch the database. It just performs one request and prints the HTTP status.
 *
 * Usage:
 *   npx tsx scripts/test-smarty-us-street.ts
 */

import * as dotenv from 'dotenv';

dotenv.config();

type SecretsManager = {
  getSecret: (name: string) => Promise<string | null>;
};

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const secretsManager = require('../server/src/services/secretsManager') as SecretsManager;

  const authId = (await secretsManager.getSecret('smarty_auth_id')) || process.env.SMARTY_AUTH_ID;
  const authToken =
    (await secretsManager.getSecret('smarty_auth_token')) || process.env.SMARTY_AUTH_TOKEN;

  if (!authId || !authToken) {
    console.error('Missing Smarty credentials (smarty_auth_id / smarty_auth_token).');
    process.exit(2);
  }

  const url = new URL('https://us-street.api.smarty.com/street-address');
  url.searchParams.set('auth-id', authId);
  url.searchParams.set('auth-token', authToken);
  url.searchParams.set('street', '1 Infinite Loop');
  url.searchParams.set('city', 'Cupertino');
  url.searchParams.set('state', 'CA');
  url.searchParams.set('candidates', '1');

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const body = await res.text().catch(() => '');

  console.log(`Smarty US Street API status: ${res.status}`);
  if (!res.ok) {
    console.log(body.slice(0, 300));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e?.message || String(e));
    process.exit(1);
  });
}
