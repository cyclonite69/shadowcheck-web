export {};
const express = require('express');
const router = express.Router();
const logger = require('../../../../logging/logger');
const { getAwsConfig } = require('../../../../services/awsService');

const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const buildClientConfig = async () => {
  const { region, credentials } = await getAwsConfig();
  if (!region) {
    throw new Error('AWS region not configured');
  }
  const config: Record<string, any> = { region };
  if (credentials) {
    config.credentials = credentials;
  }
  return config;
};

const listInstances = async (client: any) => {
  const instances: any[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeInstancesCommand({ NextToken: nextToken, MaxResults: 50 })
    );
    const reservations = response.Reservations || [];
    reservations.forEach((reservation: any) => {
      (reservation.Instances || []).forEach((instance: any) => {
        const nameTag = (instance.Tags || []).find((tag: any) => tag.Key === 'Name');
        instances.push({
          instanceId: instance.InstanceId || null,
          name: nameTag?.Value || null,
          state: instance.State?.Name || null,
          instanceType: instance.InstanceType || null,
          availabilityZone: instance.Placement?.AvailabilityZone || null,
          publicIp: instance.PublicIpAddress || null,
          privateIp: instance.PrivateIpAddress || null,
          launchTime: instance.LaunchTime || null,
        });
      });
    });
    nextToken = response.NextToken;
  } while (nextToken);

  return instances;
};

const buildStateCounts = (instances: any[]) => {
  const counts: Record<string, number> = {};
  instances.forEach((instance) => {
    const state = instance.state || 'unknown';
    counts[state] = (counts[state] || 0) + 1;
  });
  return {
    total: instances.length,
    states: counts,
  };
};

router.get('/admin/aws/overview', async (req, res) => {
  try {
    const { region, hasExplicitCredentials } = await getAwsConfig();
    if (!region) {
      return res.json({ configured: false, error: 'AWS region not configured' });
    }

    const clientConfig = await buildClientConfig();
    const stsClient = new STSClient(clientConfig);
    const ec2Client = new EC2Client(clientConfig);

    let identity = null;
    try {
      const identityResult = await stsClient.send(new GetCallerIdentityCommand({}));
      identity = {
        account: identityResult.Account || null,
        arn: identityResult.Arn || null,
        userId: identityResult.UserId || null,
      };
    } catch (error: any) {
      logger.warn('[AWS] Failed to resolve caller identity', { error: error.message });
    }

    const instances = await listInstances(ec2Client);
    const counts = buildStateCounts(instances);

    res.json({
      configured: hasExplicitCredentials || Boolean(identity),
      region,
      identity,
      counts,
      instances,
    });
  } catch (error: any) {
    logger.error('[AWS] Failed to load overview', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message || 'Failed to load AWS overview' });
  }
});

module.exports = router;
