#!/usr/bin/env node
/**
 * Bootstrap Secrets - Generate and store required secrets in keyring
 * Run once on initial deployment or when secrets are missing
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MACHINE_ID_FILE = path.join(os.homedir(), '.shadowcheck-machine-id');
const REQUIRED_SECRETS = ['db_password', 'session_secret'];

interface KeyringService {
  setCredential(key: string, value: string): Promise<void>;
  getCredential(key: string): Promise<string | null>;
}

/**
 * Get or create machine ID for encryption
 */
function getMachineId(): string {
  if (fs.existsSync(MACHINE_ID_FILE)) {
    return fs.readFileSync(MACHINE_ID_FILE, 'utf8').trim();
  }

  const machineId = `${os.hostname()}-${os.userInfo().username}`;
  fs.writeFileSync(MACHINE_ID_FILE, machineId, { mode: 0o600 });
  console.log(`✅ Created machine ID: ${machineId}`);
  return machineId;
}

/**
 * Generate cryptographically secure random password
 */
function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

/**
 * Bootstrap all required secrets
 */
async function bootstrap() {
  console.log('🔐 ShadowCheck Secrets Bootstrap\n');

  // Ensure machine ID exists
  const machineId = getMachineId();
  process.env.KEYRING_MACHINE_ID = machineId;

  // Load keyring service
  const keyringService: KeyringService = require('../server/src/services/keyringService');

  let generated = 0;
  let existing = 0;

  for (const secret of REQUIRED_SECRETS) {
    const value = await keyringService.getCredential(secret);
    
    if (value) {
      console.log(`✓ ${secret}: already exists`);
      existing++;
    } else {
      const newValue = generateSecret();
      await keyringService.setCredential(secret, newValue);
      console.log(`✅ ${secret}: generated and stored`);
      generated++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Existing: ${existing}`);
  console.log(`   Machine ID: ${machineId}`);
  console.log(`\n💡 Optional secrets can be added via admin UI or:`);
  console.log(`   node scripts/set-secret.js <key> <value>`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err.message);
  process.exit(1);
});
