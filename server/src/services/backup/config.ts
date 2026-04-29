import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

const repoRoot = '/app';

export const getBackupSource = (): {
  hostname: string;
  environment: string;
  instanceId?: string;
} => {
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
      return { hostname, environment: 'aws-ec2', instanceId };
    }
  } catch {
    // Fall through to hostname heuristics.
  }

  if (hostname.endsWith('.ec2.internal')) {
    return { hostname, environment: 'aws-ec2' };
  }

  return { hostname, environment: 'local' };
};

export const getBackupDir = (): string => {
  const configured = process.env.BACKUP_DIR;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
  }
  return path.join(repoRoot, 'backups', 'db');
};

export const stamp = (): string => {
  const d = new Date();
  const pad = (n: number | string) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export const getConfiguredS3BackupBucket = (): string => {
  const bucketName = process.env.S3_BACKUP_BUCKET?.trim();
  if (!bucketName) {
    throw new Error(
      'S3_BACKUP_BUCKET is not configured. Set it via environment or AWS SSM Parameter Store before using S3 backup operations.'
    );
  }
  return bucketName;
};
