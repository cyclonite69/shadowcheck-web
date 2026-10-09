import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import { getLogDirectory } from '../logging/logDir';

export {};

const logsDir = getLogDirectory();
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

type WigleAuditPayload = {
  entrypoint: string;
  endpointType: string;
  paramsHash: string;
  status: number | string;
  latencyMs: number;
  servedFromCache: boolean;
  retryCount: number;
  kind?: string;
};

const wigleAuditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'wigle-audit.log'),
      maxsize: 5_242_880,
      maxFiles: 5,
    }),
  ],
});

function logWigleAuditEvent(payload: WigleAuditPayload) {
  wigleAuditLogger.info({
    timestampIso: new Date().toISOString(),
    ...payload,
  });
}

export { logWigleAuditEvent };
