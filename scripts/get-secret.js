#!/usr/bin/env node
/**
 * Get Secret - Read secret from keyring and output to stdout
 * Usage: node scripts/get-secret.js <secret_name>
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MACHINE_ID_FILE = path.join(os.homedir(), '.shadowcheck-machine-id');

async function getSecret(secretName) {
  if (!secretName) {
    console.error('Usage: node scripts/get-secret.js <secret_name>');
    process.exit(1);
  }

  // Load machine ID
  if (fs.existsSync(MACHINE_ID_FILE)) {
    const machineId = fs.readFileSync(MACHINE_ID_FILE, 'utf8').trim();
    process.env.KEYRING_MACHINE_ID = machineId;
  }

  // Load keyring service - use the compiled version
  let keyringService;
  try {
    // Try compiled version first (production)
    keyringService = require('../dist/server/server/src/services/keyringService.js');
  } catch {
    try {
      // Fallback to source (development)
      keyringService = require('../server/src/services/keyringService');
    } catch (err2) {
      console.error(`Failed to load keyring service: ${err2.message}`);
      process.exit(1);
    }
  }

  try {
    const value = await keyringService.getCredential(secretName);
    if (value) {
      process.stdout.write(value);
      process.exit(0);
    } else {
      console.error(`Secret '${secretName}' not found in keyring`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Failed to read secret: ${err.message}`);
    process.exit(1);
  }
}

const secretName = process.argv[2];
getSecret(secretName);
