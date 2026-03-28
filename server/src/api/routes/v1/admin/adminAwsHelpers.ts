const { awsService } = require('../../../../config/container');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const isAccessDeniedError = (error: any) => {
  const text = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    text.includes('accessdenied') ||
    text.includes('unauthorizedoperation') ||
    text.includes('not authorized')
  );
};

const isCredentialError = (error: any) => {
  const text = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    text.includes('credential') ||
    text.includes('expiredtoken') ||
    text.includes('invalidclienttokenid') ||
    text.includes('unable to locate') ||
    text.includes('token') ||
    text.includes('sso')
  );
};

const buildClientConfig = async () => {
  const { region } = await awsService.getAwsConfig();
  if (!region) {
    throw new Error('AWS region not configured');
  }
  return { region };
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

module.exports = {
  listInstances,
  buildClientConfig,
  buildStateCounts,
  isAccessDeniedError,
  isCredentialError,
  EC2Client,
  STSClient,
  GetCallerIdentityCommand,
};
