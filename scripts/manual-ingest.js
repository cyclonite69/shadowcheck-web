/**
 * Manual Mobile Ingest Trigger (JS version for production compatibility)
 * Triggers the processing of a mobile upload by ID.
 */
const path = require('path');
const fs = require('fs');

async function run() {
  const uploadId = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

  if (isNaN(uploadId)) {
    console.error('Usage: node scripts/manual-ingest.js <uploadId>');
    process.exit(1);
  }

  let service;
  let log;

  // Detect pathing
  if (fs.existsSync(path.join(__dirname, '../server/src/services/mobileIngestService.ts'))) {
    // Development mode
    console.log('Development mode detected, using ts-node/register');
    require('ts-node').register();
    service = require('../server/src/services/mobileIngestService').default;
    log = require('../server/src/logging/logger').default;
  } else {
    // Production mode
    console.log('Production mode detected, using compiled modules from dist/');
    // Based on actual container paths found earlier: /app/dist/server/server/src/services/mobileIngestService.js
    const servicePath = path.join(
      __dirname,
      '../dist/server/server/src/services/mobileIngestService'
    );
    const loggerPath = path.join(__dirname, '../dist/server/server/src/logging/logger');

    service = require(servicePath).default || require(servicePath);
    log = require(loggerPath).default || require(loggerPath);
  }

  log.info(`Manually triggering process for upload ID: ${uploadId}`);
  try {
    await service.processUpload(uploadId);
    log.info(`Successfully processed upload ID: ${uploadId}`);
    process.exit(0);
  } catch (error) {
    console.error(`Failed to process upload ID: ${uploadId}`, error);
    process.exit(1);
  }
}

run();
