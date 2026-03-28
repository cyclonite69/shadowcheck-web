import os from 'os';
import { spawn } from 'child_process';
import logger from '../../logging/logger';

const { getAwsConfig } = require('../awsService');

export {};

const buildAwsCliEnv = async (): Promise<Record<string, string>> => {
  const awsConfig = await getAwsConfig();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}`,
  };

  if (awsConfig.region) {
    env.AWS_DEFAULT_REGION = awsConfig.region;
  }

  return env;
};

const runAwsCliJson = async (args: string[]): Promise<string> => {
  const env = await buildAwsCliEnv();

  return new Promise((resolve, reject) => {
    const child = spawn('aws', args, { env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      reject(err);
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `AWS CLI command failed with code ${code}`));
      }
    });
  });
};

const uploadBackupToS3 = async (
  bucketName: string,
  filePath: string,
  fileName: string,
  source?: { hostname: string; environment: string; instanceId?: string }
): Promise<{ bucket: string; key: string; url: string }> => {
  const envLabel = source?.environment || 'unknown';
  const s3Key = `backups/${envLabel}/${fileName}`;

  logger.info(`[Backup] Uploading to S3: s3://${bucketName}/${s3Key}`);

  const metadataStr = [
    `source-env=${envLabel}`,
    `source-host=${source?.hostname || os.hostname()}`,
    source?.instanceId ? `instance-id=${source.instanceId}` : null,
    `created-at=${new Date().toISOString()}`,
  ]
    .filter((m): m is string => Boolean(m))
    .join(',');

  await runAwsCliJson([
    's3',
    'cp',
    filePath,
    `s3://${bucketName}/${s3Key}`,
    '--storage-class',
    'STANDARD_IA',
    '--metadata',
    metadataStr,
  ]);

  return {
    bucket: bucketName,
    key: s3Key,
    url: `s3://${bucketName}/${s3Key}`,
  };
};

const listS3BackupObjects = async (bucketName: string): Promise<any[]> => {
  logger.info(`[Backup] Listing S3 backups from s3://${bucketName}/backups/`);

  const stdout = await runAwsCliJson([
    's3api',
    'list-objects-v2',
    '--bucket',
    bucketName,
    '--prefix',
    'backups/',
    '--query',
    'Contents[?Size>`0`].{Key:Key,Size:Size,LastModified:LastModified}',
    '--output',
    'json',
  ]);

  return JSON.parse(stdout || '[]');
};

const deleteS3BackupObject = async (bucketName: string, key: string): Promise<void> => {
  logger.info(`[Backup] Deleting S3 backup: s3://${bucketName}/${key}`);

  await runAwsCliJson(['s3api', 'delete-object', '--bucket', bucketName, '--key', key]);
};

export {
  buildAwsCliEnv,
  deleteS3BackupObject,
  listS3BackupObjects,
  runAwsCliJson,
  uploadBackupToS3,
};
