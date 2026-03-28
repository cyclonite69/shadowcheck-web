const logger = require('../../logging/logger');

import {
  composeFile,
  composeFileExists,
  containerName,
  dockerHost,
  enforceRestartPolicy,
  localMode,
  parseDockerStatus,
  pgAdminEmail,
  pgAdminPassword,
  port,
  probePgAdminReachable,
  removePgAdminContainer,
  runCommand,
  runCompose,
  serviceName,
  url,
  volumeName,
} from './runtime';

export const getPgAdminStatus = async () => {
  const status = {
    dockerHost,
    composeFile,
    composeFileExists: await composeFileExists(),
    serviceName,
    containerName,
    volumeName,
    port,
    url,
    dockerAvailable: true,
    container: {
      exists: false,
      running: false,
      status: '',
      ports: '',
      id: '',
      name: containerName,
    },
    error: '',
  };

  try {
    const result = await runCommand('docker', [
      'ps',
      '-a',
      '--filter',
      `name=${containerName}`,
      '--format',
      '{{.ID}}||{{.Names}}||{{.Status}}||{{.Ports}}',
    ]);

    status.container = parseDockerStatus(result.stdout);
  } catch (err) {
    status.dockerAvailable = false;
    status.error = (err as any)?.message || 'Docker CLI not available';
  }

  if (!status.container.running && (await probePgAdminReachable())) {
    status.container = {
      exists: true,
      running: true,
      status: status.dockerAvailable ? 'Up (HTTP probe)' : 'Reachable (HTTP probe)',
      ports: `127.0.0.1:${port}->${port}/tcp`,
      id: status.container.id,
      name: containerName,
    };
    if (!status.dockerAvailable) {
      status.error = '';
    }
  }

  return status;
};

export const destroyPgAdmin = async ({ removeVolume = false }: { removeVolume?: boolean } = {}) => {
  logger.info('[PgAdmin] Destroy requested', { removeVolume });
  await removePgAdminContainer();

  if (removeVolume && volumeName) {
    await runCommand('docker', ['volume', 'rm', '-f', volumeName], { allowFail: true });
  }

  return {
    composeFile,
    serviceName,
    volumeRemoved: removeVolume,
  };
};

export const startPgAdmin = async ({ reset }: { reset?: boolean } = {}) => {
  if (reset) {
    logger.warn('[PgAdmin] Reset requested. Removing container and volume.');
    await destroyPgAdmin({ removeVolume: true });
  }

  try {
    const inspectResult = await runCommand(
      'docker',
      ['inspect', '--format', '{{.State.Running}}', containerName],
      { allowFail: true }
    );
    if (inspectResult.stdout.trim() === 'false') {
      logger.info('[PgAdmin] Container exists but stopped, starting it');
      const startResult = await runCommand('docker', ['start', containerName]);
      await enforceRestartPolicy();
      return {
        output: startResult.stdout,
        warnings: startResult.stderr,
        composeFile,
        serviceName,
      };
    }
  } catch (err) {
    // Container doesn't exist, proceed with compose up
  }

  if (localMode) {
    logger.info('[PgAdmin] Starting local PgAdmin via docker run');
    await runCommand('docker', ['rm', '-f', containerName], { allowFail: true });
    const runResult = await runCommand('docker', [
      'run',
      '-d',
      '--name',
      containerName,
      '--restart',
      'unless-stopped',
      '-p',
      `127.0.0.1:${port}:${port}`,
      '-e',
      `PGADMIN_DEFAULT_EMAIL=${pgAdminEmail}`,
      '-e',
      `PGADMIN_DEFAULT_PASSWORD=${pgAdminPassword}`,
      '-e',
      'PGADMIN_CONFIG_SERVER_MODE=False',
      '-e',
      'PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=False',
      '-e',
      'PGADMIN_LISTEN_ADDRESS=0.0.0.0',
      '-e',
      `PGADMIN_LISTEN_PORT=${port}`,
      '-e',
      'PGADMIN_DEFAULT_SERVER_HOST=host.containers.internal',
      '-v',
      `${volumeName}:/var/lib/pgadmin`,
      'dpage/pgadmin4:latest',
    ]);

    return {
      output: runResult.stdout,
      warnings: runResult.stderr,
      composeFile: 'local-docker-run',
      serviceName,
    };
  }

  logger.info('[PgAdmin] Starting PgAdmin via docker-compose');
  const result = await runCompose(['up', '-d', '--no-deps', serviceName]);
  await enforceRestartPolicy();

  return {
    output: result.stdout,
    warnings: result.stderr,
    composeFile,
    serviceName,
  };
};

export const stopPgAdmin = async () => {
  if (localMode) {
    logger.info('[PgAdmin] Stopping local PgAdmin via docker stop');
    const result = await runCommand('docker', ['stop', containerName], { allowFail: true });
    return {
      output: result.stdout,
      warnings: result.stderr,
      composeFile: 'local-docker-run',
      serviceName,
    };
  }

  logger.info('[PgAdmin] Stopping PgAdmin via docker-compose');
  const result = await runCompose(['stop', serviceName]);
  return {
    output: result.stdout,
    warnings: result.stderr,
    composeFile,
    serviceName,
  };
};
