import * as path from 'path';

export const getLogDirectory = (): string =>
  process.env.LOG_DIR || path.join(process.cwd(), 'logs');
