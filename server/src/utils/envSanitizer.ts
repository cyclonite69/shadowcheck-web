/**
 * Clears PostgreSQL-related environment variables that can override app config.
 */
function clearPostgresEnv(): void {
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGDATABASE;
  delete process.env.PGUSER;
}

export { clearPostgresEnv };
