/**
 * External service helpers.
 * Provides simple retry and timeout wrappers for outbound requests.
 */

/**
 * Waits for a given number of milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs an async function with timeout and retry support.
 * @param {() => Promise<any>} serviceFn - Async function to execute
 * @param {object} options - Retry and timeout options
 * @param {number} [options.maxRetries=2] - Number of retry attempts
 * @param {number} [options.retryDelayMs=500] - Base delay between retries (ms)
 * @param {number} [options.timeoutMs=10000] - Timeout per attempt (ms)
 * @param {string} [options.serviceName='External service'] - Friendly name for errors
 * @returns {Promise<any>} Result of serviceFn
 * @throws {Error} When all retries fail
 */
async function withRetry(serviceFn, options = {}) {
  const {
    maxRetries = 2,
    retryDelayMs = 500,
    timeoutMs = 10000,
    serviceName = 'External service',
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${serviceName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return await Promise.race([serviceFn(), timeoutPromise]);
    } catch (err) {
      lastError = err;
      if (attempt <= maxRetries) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  throw new Error(`${serviceName} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}

module.exports = {
  delay,
  withRetry,
};
