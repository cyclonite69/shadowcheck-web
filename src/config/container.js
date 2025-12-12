/**
 * Dependency Injection Container
 * Manages service instances and dependencies
 */

const NetworkRepository = require('../repositories/networkRepository');
const DashboardService = require('../services/dashboardService');

class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a singleton instance
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  registerSingleton(name, instance) {
    this.singletons.set(name, instance);
  }

  /**
   * Register a factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   */
  registerFactory(name, factory) {
    this.services.set(name, factory);
  }

  /**
   * Get service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    // Check singletons first
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check factories
    if (this.services.has(name)) {
      const factory = this.services.get(name);
      return factory(this);
    }

    throw new Error(`Service '${name}' not found in container`);
  }

  /**
   * Check if service exists
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.singletons.has(name) || this.services.has(name);
  }
}

/**
 * Initialize application container with all services
 * @returns {Container}
 */
function initContainer() {
  const container = new Container();

  // Register repositories
  container.registerFactory('networkRepository', () => new NetworkRepository());

  // Register services
  container.registerFactory(
    'dashboardService',
    (c) => new DashboardService(c.get('networkRepository'))
  );

  return container;
}

module.exports = { Container, initContainer };
