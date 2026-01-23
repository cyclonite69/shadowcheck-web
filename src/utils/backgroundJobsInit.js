/**
 * Initialize background jobs.
 * @returns {Promise<void>} Resolves after initialization
 */
async function initializeBackgroundJobs() {
  const BackgroundJobsService = require('../services/backgroundJobsService');
  await BackgroundJobsService.initialize();
}

module.exports = { initializeBackgroundJobs };
