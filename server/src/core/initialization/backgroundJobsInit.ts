/**
 * Background jobs initialization.
 */

/**
 * Initialize background jobs.
 */
async function initializeBackgroundJobs(): Promise<void> {
  const featureFlagService = require('../../services/featureFlagService');
  if (!featureFlagService.getFlag('enable_background_jobs')) {
    console.log('[Background Jobs] Skipped (manual-only mode)');
    return;
  }

  const BackgroundJobsService = require('../../services/backgroundJobsService');
  await BackgroundJobsService.initialize();
}

export { initializeBackgroundJobs };
