export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const logger = require('../../../../logging/logger');
const { getAwsConfig } = require('../../../../config/container').awsService;
const {
  buildClientConfig,
  listInstances,
  buildStateCounts,
  isAccessDeniedError,
  isCredentialError,
  EC2Client,
  STSClient,
  GetCallerIdentityCommand,
} = require('./adminAwsHelpers');

const isLocalRuntime =
  (process.env.DB_HOST || '').trim() === 'postgres' && process.env.NODE_ENV !== 'production';

router.get('/admin/aws/overview', async (req: Request, res: Response) => {
  try {
    const { region } = await getAwsConfig();
    if (!region) {
      return res.status(503).json({
        ok: false,
        error: 'AWS integration not configured',
        code: 'AWS_NOT_CONFIGURED',
      });
    }

    const clientConfig = await buildClientConfig();
    const stsClient = new STSClient(clientConfig);
    const ec2Client = new EC2Client(clientConfig);

    let identity = null;
    let credentialsAvailable = false;
    try {
      const identityResult = await stsClient.send(new GetCallerIdentityCommand({}));
      identity = {
        account: identityResult.Account || null,
        arn: identityResult.Arn || null,
        userId: identityResult.UserId || null,
      };
      credentialsAvailable = true;
    } catch (error: any) {
      logger.warn('[AWS] Failed to resolve caller identity', { error: error.message });
    }

    let instances: any[] = [];
    let counts = { total: 0, states: {} as Record<string, number> };
    let warning: string | undefined;

    try {
      instances = await listInstances(ec2Client);
      counts = buildStateCounts(instances);
    } catch (error: any) {
      if (isAccessDeniedError(error)) {
        warning =
          'Missing permission ec2:DescribeInstances for current role; showing identity and region only.';
        logger.warn('[AWS] Missing DescribeInstances permission', { error: error.message });
      } else {
        warning = isLocalRuntime
          ? 'Local runtime has no AWS credentials loaded; showing region only.'
          : 'AWS credentials unavailable; showing region only.';
        logger.warn('[AWS] AWS SDK error listing instances', { error: error.message });
      }
    }

    res.json({
      ok: true,
      configured: Boolean(identity),
      credentialsAvailable,
      mode: isLocalRuntime ? 'local' : 'aws',
      region,
      identity,
      counts,
      instances,
      warning,
    });
  } catch (error: any) {
    logger.error('[AWS] Failed to load overview', { error: error.message, stack: error.stack });
    return res.status(500).json({ ok: false, error: error.message, code: 'AWS_ERROR' });
  }
});

module.exports = router;
