type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined) || 'info';
const minLevel = levelOrder[configuredLevel] ?? levelOrder.info;

function shouldLog(level: LogLevel) {
  if (levelOrder[level] < minLevel) {
    return false;
  }
  if (!isDev && (level === 'debug' || level === 'info')) {
    return false;
  }
  return true;
}

function log(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) {
    return;
  }
  const prefix = `[${level.toUpperCase()}]`;
  if (meta !== undefined) {
    console[level](`${prefix} ${message}`, meta);
    return;
  }
  console[level](`${prefix} ${message}`);
}

export function logDebug(message: string, meta?: unknown) {
  log('debug', message, meta);
}

export function logInfo(message: string, meta?: unknown) {
  log('info', message, meta);
}

export function logWarn(message: string, meta?: unknown) {
  log('warn', message, meta);
}

export function logError(message: string, meta?: unknown) {
  log('error', message, meta);
}
