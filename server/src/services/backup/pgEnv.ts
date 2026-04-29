import logger from '../../logging/logger';
import secretsManager from '../secretsManager';

export const buildPgEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!env.PGHOST && process.env.DB_HOST) env.PGHOST = process.env.DB_HOST;
  if (!env.PGPORT && process.env.DB_PORT) env.PGPORT = String(process.env.DB_PORT);
  if (!env.PGUSER && process.env.DB_USER) env.PGUSER = process.env.DB_USER;
  if (!env.PGDATABASE && process.env.DB_NAME) env.PGDATABASE = process.env.DB_NAME;
  if (!env.PGPASSWORD) {
    const secret = secretsManager.get('db_password');
    if (secret) env.PGPASSWORD = secret;
  }
  return env;
};

export const buildBackupPgEnv = (): NodeJS.ProcessEnv => {
  const env = buildPgEnv();
  const preferredAdminUser = process.env.DB_ADMIN_USER || 'shadowcheck_admin';
  const adminPassword = secretsManager.get('db_admin_password') || process.env.DB_ADMIN_PASSWORD;
  const allowPasswordlessLocalAdmin =
    !adminPassword &&
    (process.env.DB_HOST || '').trim() === 'postgres' &&
    process.env.DB_SSL !== 'true';

  if (adminPassword) {
    env.PGUSER = preferredAdminUser;
    env.PGPASSWORD = adminPassword;
    logger.info(`[Backup] Using admin DB role for backup operations: ${preferredAdminUser}`);
  } else if (allowPasswordlessLocalAdmin) {
    env.PGUSER = preferredAdminUser;
    env.PGPASSWORD = '';
    logger.warn(
      `[Backup] db_admin_password not found; using passwordless local admin role for backup operations: ${preferredAdminUser}`
    );
  } else {
    logger.warn(
      '[Backup] db_admin_password not found; falling back to application DB credentials for backup'
    );
  }

  return env;
};
