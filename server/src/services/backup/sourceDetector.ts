import os from 'os';
import { execSync } from 'child_process';
import logger from '../../logging/logger';

/**
 * Backup source metadata
 */
export interface BackupSource {
  hostname: string;
  environment: string;
  instanceId?: string;
}

/**
 * Detect backup source environment.
 * Returns metadata identifying where the backup was created.
 * Prefers explicit config, then IMDSv2, then hostname heuristics.
 */
export const detectBackupSource = (): BackupSource => {
  const hostname = os.hostname();
  const configuredEnvironment = String(process.env.BACKUP_SOURCE_ENV || '').trim();
  const configuredInstanceId = String(process.env.EC2_INSTANCE_ID || '').trim();

  if (configuredEnvironment) {
    return {
      hostname,
      environment: configuredEnvironment,
      instanceId: configuredInstanceId || undefined,
    };
  }

  // Prefer IMDSv2, then fall back to hostname heuristics when container IMDS access is blocked.
  try {
    const instanceId = execSync(
      `TOKEN=$(curl -fsS -m 1 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null) && curl -fsS -m 1 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null`,
      { timeout: 2000, encoding: 'utf8' }
    ).trim();
    if (instanceId && instanceId.startsWith('i-')) {
      logger.debug(`[Backup] Detected EC2 instance: ${instanceId}`);
      return { hostname, environment: 'aws-ec2', instanceId };
    }
  } catch {
    logger.debug(
      '[Backup] IMDSv2 access blocked or timed out; falling back to hostname heuristics'
    );
  }

  if (hostname.endsWith('.ec2.internal')) {
    logger.debug(`[Backup] Detected EC2 from hostname: ${hostname}`);
    return { hostname, environment: 'aws-ec2' };
  }

  return { hostname, environment: 'local' };
};
