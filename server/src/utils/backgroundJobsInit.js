/**
 * Initialize background jobs.
 * @returns {Promise<void>} Resolves after initialization
 */
async function initializeBackgroundJobs() {
  if (process.env.ENABLE_BACKGROUND_JOBS !== 'true') {
    console.log('[Background Jobs] Skipped (manual-only mode)');
    return;
  }

  const BackgroundJobsService = require('../services/backgroundJobsService');
  await BackgroundJobsService.initialize();
}

module.exports = { initializeBackgroundJobs };
