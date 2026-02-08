#!/usr/bin/env node
/**
 * Set Secret - Store secret in keyring
 * Usage: node scripts/set-secret.js <secret_name> [value]
 * If value is omitted, reads from stdin
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const MACHINE_ID_FILE = path.join(os.homedir(), '.shadowcheck-machine-id');

async function setSecret(secretName, secretValue) {
  if (!secretName) {
    console.error('Usage: node scripts/set-secret.js <secret_name> [value]');
    process.exit(1);
  }

  // Load machine ID
  if (fs.existsSync(MACHINE_ID_FILE)) {
    const machineId = fs.readFileSync(MACHINE_ID_FILE, 'utf8').trim();
    process.env.KEYRING_MACHINE_ID = machineId;
  } else {
    console.error('Machine ID not found. Run bootstrap-secrets.ts first.');
    process.exit(1);
  }

  // Get value from stdin if not provided
  let value = secretValue;
  if (!value) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    value = await new Promise((resolve) => {
      rl.question(`Enter value for '${secretName}': `, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  if (!value) {
    console.error('No value provided');
    process.exit(1);
  }

  // Load keyring service - try both ESM and CommonJS
  let keyringService;
  try {
    const module = await import('../server/src/services/keyringService.js');
    keyringService = module.default || module;
  } catch (err) {
    try {
      keyringService = require('../server/src/services/keyringService');
    } catch (err2) {
      console.error(`Failed to load keyring service: ${err2.message}`);
      process.exit(1);
    }
  }

  try {
    await keyringService.setCredential(secretName, value);
    console.log(`✅ Secret '${secretName}' stored in keyring`);
    process.exit(0);
  } catch (err) {
    console.error(`Failed to store secret: ${err.message}`);
    process.exit(1);
  }
}

const secretName = process.argv[2];
const secretValue = process.argv[3];
setSecret(secretName, secretValue);
