/**
 * AWS EC2 Instance Management Routes
 */

import { Router } from 'express';
const logger = require('../../../../logging/logger');
const { awsService } = require('../../../../config/container');
const { getAwsConfig } = awsService;

const router = Router();

const getEc2Client = async () => {
  const { EC2Client } = require('@aws-sdk/client-ec2');
  const { region } = await getAwsConfig();
  if (!region) {
    throw new Error('AWS region not configured');
  }
  return new EC2Client({ region });
};

// POST /api/admin/aws/instances/:instanceId/start
router.post('/instances/:instanceId/start', async (req, res) => {
  try {
    const { StartInstancesCommand } = require('@aws-sdk/client-ec2');
    const { instanceId } = req.params;

    const client = await getEc2Client();
    const command = new StartInstancesCommand({ InstanceIds: [instanceId] });
    await client.send(command);

    logger.info(`Started EC2 instance: ${instanceId}`);
    res.json({ ok: true, message: `Instance ${instanceId} starting` });
  } catch (error: any) {
    logger.error('Failed to start instance', { error: error.message });
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/admin/aws/instances/:instanceId/stop
router.post('/instances/:instanceId/stop', async (req, res) => {
  try {
    const { StopInstancesCommand } = require('@aws-sdk/client-ec2');
    const { instanceId } = req.params;

    const client = await getEc2Client();
    const command = new StopInstancesCommand({ InstanceIds: [instanceId] });
    await client.send(command);

    logger.info(`Stopped EC2 instance: ${instanceId}`);
    res.json({ ok: true, message: `Instance ${instanceId} stopping` });
  } catch (error: any) {
    logger.error('Failed to stop instance', { error: error.message });
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/admin/aws/instances/:instanceId/reboot
router.post('/instances/:instanceId/reboot', async (req, res) => {
  try {
    const { RebootInstancesCommand } = require('@aws-sdk/client-ec2');
    const { instanceId } = req.params;

    const client = await getEc2Client();
    const command = new RebootInstancesCommand({ InstanceIds: [instanceId] });
    await client.send(command);

    logger.info(`Rebooted EC2 instance: ${instanceId}`);
    res.json({ ok: true, message: `Instance ${instanceId} rebooting` });
  } catch (error: any) {
    logger.error('Failed to reboot instance', { error: error.message });
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/admin/aws/instances/:instanceId/terminate
router.post('/instances/:instanceId/terminate', async (req, res) => {
  try {
    const { TerminateInstancesCommand } = require('@aws-sdk/client-ec2');
    const { instanceId } = req.params;
    const { confirm } = req.body;

    if (confirm !== instanceId) {
      return res.status(400).json({
        ok: false,
        error: 'Confirmation required. Send instanceId in body.confirm',
      });
    }

    const client = await getEc2Client();
    const command = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
    await client.send(command);

    logger.warn(`Terminated EC2 instance: ${instanceId}`);
    res.json({ ok: true, message: `Instance ${instanceId} terminating` });
  } catch (error: any) {
    logger.error('Failed to terminate instance', { error: error.message });
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
