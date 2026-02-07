import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { URL } from 'url';

export {};

const authService = require('../services/authService');
const { getAwsConfig } = require('../services/awsService');

const INSTANCE_ID_RE = /^i-[0-9a-f]{8,17}$/;
const MAX_CONCURRENT_SESSIONS = 5;

let activeSessions = 0;
let wss: WebSocketServer | null = null;

interface WsMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

function destroyWithMessage(socket: import('net').Socket, statusCode: number, message: string) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n${message}`
  );
  socket.destroy();
}

function initializeSsmWebSocket(
  server: HttpServer,
  logger: { info: Function; warn: Function; error: Function }
) {
  wss = new WebSocketServer({ noServer: true });

  server.on(
    'upgrade',
    async (request: IncomingMessage, socket: import('net').Socket, head: Buffer) => {
      try {
        const url = new URL(request.url || '', `http://${request.headers.host}`);

        if (url.pathname !== '/ws/ssm') {
          return; // Not our route — let other handlers (if any) deal with it
        }

        // Auth: parse session_token from cookie
        const cookies = parseCookies(request.headers.cookie);
        const token = cookies.session_token;
        if (!token) {
          return destroyWithMessage(socket, 401, 'Unauthorized');
        }

        const session = await authService.validateSession(token);
        if (!session.valid) {
          return destroyWithMessage(socket, 401, 'Unauthorized');
        }
        if (session.user.role !== 'admin') {
          return destroyWithMessage(socket, 403, 'Forbidden');
        }

        // Validate instanceId
        const instanceId = url.searchParams.get('instanceId');
        if (!instanceId || !INSTANCE_ID_RE.test(instanceId)) {
          return destroyWithMessage(socket, 400, 'Invalid instanceId');
        }

        // Concurrency cap
        if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
          return destroyWithMessage(socket, 429, 'Too many active sessions');
        }

        wss!.handleUpgrade(request, socket, head, (ws) => {
          wss!.emit('connection', ws, request, { instanceId, user: session.user });
        });
      } catch (err) {
        logger.error('SSM WebSocket upgrade error', { error: (err as Error).message });
        destroyWithMessage(socket, 500, 'Internal Server Error');
      }
    }
  );

  wss.on(
    'connection',
    async (
      ws: WebSocket,
      _request: IncomingMessage,
      ctx: { instanceId: string; user: { username: string } }
    ) => {
      activeSessions++;
      let child: ChildProcess | null = null;
      let killed = false;

      const send = (type: string, data?: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, data }));
        }
      };

      try {
        const awsConfig = await getAwsConfig();
        if (!awsConfig.hasExplicitCredentials) {
          send('error', 'AWS credentials not configured');
          ws.close();
          activeSessions--;
          return;
        }

        const env: Record<string, string> = {
          ...(process.env as Record<string, string>),
          AWS_ACCESS_KEY_ID: awsConfig.credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: awsConfig.credentials.secretAccessKey,
        };
        if (awsConfig.region) {
          env.AWS_DEFAULT_REGION = awsConfig.region;
        }
        if (awsConfig.credentials.sessionToken) {
          env.AWS_SESSION_TOKEN = awsConfig.credentials.sessionToken;
        }

        logger.info(`SSM session starting for ${ctx.instanceId} by ${ctx.user.username}`);
        send('status', `Connecting to ${ctx.instanceId}...`);

        child = spawn('aws', ['ssm', 'start-session', '--target', ctx.instanceId], {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        child.stdout!.on('data', (data: Buffer) => {
          send('output', data.toString());
        });

        child.stderr!.on('data', (data: Buffer) => {
          send('output', data.toString());
        });

        child.on('error', (err: Error) => {
          logger.error('SSM child process error', {
            error: err.message,
            instanceId: ctx.instanceId,
          });
          send('error', `Failed to start SSM session: ${err.message}`);
          ws.close();
        });

        child.on('exit', (code: number | null) => {
          logger.info(`SSM session ended for ${ctx.instanceId}, exit code: ${code}`);
          send('exit', `Session ended (exit code: ${code})`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          activeSessions--;
          child = null;
        });

        ws.on('message', (raw: Buffer | string) => {
          try {
            const msg: WsMessage = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
            if (msg.type === 'input' && child && child.stdin && !child.stdin.destroyed) {
              child.stdin.write(msg.data || '');
            }
          } catch {
            // Ignore malformed messages
          }
        });

        ws.on('close', () => {
          if (child && !killed) {
            killed = true;
            child.kill('SIGTERM');
            // Force kill if still alive after 5s
            const killTimeout = setTimeout(() => {
              if (child && !child.killed) {
                child.kill('SIGKILL');
              }
            }, 5000);
            child.on('exit', () => clearTimeout(killTimeout));
          }
          if (child) {
            // activeSessions decremented in child 'exit' handler
          } else {
            activeSessions--;
          }
        });
      } catch (err) {
        logger.error('SSM session setup error', { error: (err as Error).message });
        send('error', 'Failed to start SSM session');
        ws.close();
        activeSessions--;
      }
    }
  );

  logger.info('SSM WebSocket handler initialized on /ws/ssm');
}

function shutdownSsmWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    // Close all client connections
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }
    wss.close(() => {
      wss = null;
      resolve();
    });
  });
}

module.exports = { initializeSsmWebSocket, shutdownSsmWebSocket };
