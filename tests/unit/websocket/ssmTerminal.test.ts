import { WebSocket, WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { URL } from 'url';

// Mock dependencies
jest.mock('ws');
jest.mock('child_process');
jest.mock('../../../server/src/services/authService', () => ({
  validateSession: jest.fn(),
}));
jest.mock('../../../server/src/services/awsService', () => ({
  getAwsConfig: jest.fn(),
}));

const {
  initializeSsmWebSocket,
  shutdownSsmWebSocket,
} = require('../../../server/src/websocket/ssmTerminal');
const authService = require('../../../server/src/services/authService');
const { getAwsConfig } = require('../../../server/src/services/awsService');

describe('ssmTerminal', () => {
  let mockServer: any;
  let mockLogger: any;
  let mockWss: any;
  let mockWs: any;
  let mockChild: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = new EventEmitter();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockWs = new EventEmitter();
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
    mockWs.readyState = WebSocket.OPEN;

    mockWss = new EventEmitter();
    mockWss.handleUpgrade = jest.fn((req, socket, head, callback) => {
      callback(mockWs);
    });
    mockWss.close = jest.fn((callback) => callback());
    mockWss.clients = new Set();

    (WebSocketServer as unknown as jest.Mock).mockReturnValue(mockWss);

    mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.stdin = {
      write: jest.fn(),
      destroyed: false,
    };
    mockChild.kill = jest.fn();
    (spawn as jest.Mock).mockReturnValue(mockChild);

    getAwsConfig.mockResolvedValue({ region: 'us-east-1' });
  });

  afterEach(async () => {
    await shutdownSsmWebSocket();
  });

  it('should initialize WebSocket server and listen for upgrade events', () => {
    initializeSsmWebSocket(mockServer, mockLogger);
    expect(WebSocketServer).toHaveBeenCalledWith({ noServer: true });
    expect(mockServer.listenerCount('upgrade')).toBe(1);
  });

  it('should reject upgrades for wrong paths', async () => {
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = { url: '/wrong/path', headers: { host: 'localhost' } };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockWss.handleUpgrade).not.toHaveBeenCalled();
    expect(mockSocket.destroy).not.toHaveBeenCalled();
  });

  it('should reject unauthorized upgrades (no token)', async () => {
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = { url: '/ws/ssm', headers: { host: 'localhost' } };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockSocket.write).toHaveBeenCalledWith(
      expect.stringContaining('HTTP/1.1 401 Unauthorized')
    );
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it('should reject upgrades for invalid sessions', async () => {
    authService.validateSession.mockResolvedValue({ valid: false });
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = {
      url: '/ws/ssm',
      headers: { host: 'localhost', cookie: 'session_token=invalid' },
    };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockSocket.write).toHaveBeenCalledWith(
      expect.stringContaining('HTTP/1.1 401 Unauthorized')
    );
  });

  it('should reject upgrades for non-admin users', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'user', username: 'testuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = {
      url: '/ws/ssm',
      headers: { host: 'localhost', cookie: 'session_token=valid' },
    };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockSocket.write).toHaveBeenCalledWith(
      expect.stringContaining('HTTP/1.1 403 Forbidden')
    );
  });

  it('should reject upgrades with invalid instanceId', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = {
      url: '/ws/ssm?instanceId=invalid',
      headers: { host: 'localhost', cookie: 'session_token=valid' },
    };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockSocket.write).toHaveBeenCalledWith(
      expect.stringContaining('HTTP/1.1 400 Invalid instanceId')
    );
  });

  it('should handle successful upgrade and start SSM session', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = {
      url: '/ws/ssm?instanceId=i-1234567890abcdef0',
      headers: { host: 'localhost', cookie: 'session_token=valid' },
    };

    // Trigger upgrade
    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockWss.handleUpgrade).toHaveBeenCalled();

    // Trigger connection
    const connectionCtx = { instanceId: 'i-1234567890abcdef0', user: { username: 'adminuser' } };
    await mockWss.emit('connection', mockWs, mockRequest, connectionCtx);

    // Verify spawn call
    expect(spawn).toHaveBeenCalledWith(
      'aws',
      ['ssm', 'start-session', '--target', 'i-1234567890abcdef0'],
      expect.objectContaining({
        env: expect.objectContaining({
          AWS_DEFAULT_REGION: 'us-east-1',
        }),
      })
    );

    // Verify status message sent
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"status"'));

    // Test stdout data
    mockChild.stdout.emit('data', Buffer.from('hello world'));
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'output', data: 'hello world' })
    );

    // Test user input
    mockWs.emit('message', JSON.stringify({ type: 'input', data: 'ls\n' }));
    expect(mockChild.stdin.write).toHaveBeenCalledWith('ls\n');

    // Test stderr data
    mockChild.stderr.emit('data', Buffer.from('error occurred'));
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'output', data: 'error occurred' })
    );

    // Test child exit
    mockChild.emit('exit', 0);
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'exit', data: 'Session ended (exit code: 0)' })
    );
    expect(mockWs.close).toHaveBeenCalled();
  });

  it('should handle terminal errors in stderr', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    await mockWss.emit(
      'connection',
      mockWs,
      {},
      { instanceId: 'i-12345678', user: { username: 'admin' } }
    );

    const accessDeniedMsg = 'AccessDeniedException: ssm:StartSession is not authorized';
    mockChild.stderr.emit('data', Buffer.from(accessDeniedMsg));

    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Embedded SSM is not authorized')
    );
  });

  it('should handle child process spawn error', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    await mockWss.emit(
      'connection',
      mockWs,
      {},
      { instanceId: 'i-12345678', user: { username: 'admin' } }
    );

    mockChild.emit('error', new Error('Spawn failed'));

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Failed to start SSM session')
    );
    expect(mockWs.close).toHaveBeenCalled();
  });

  it('should kill child process on WebSocket close', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);
    await mockWss.emit(
      'connection',
      mockWs,
      {},
      { instanceId: 'i-12345678', user: { username: 'admin' } }
    );

    mockWs.emit('close');

    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should enforce concurrency cap', async () => {
    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { role: 'admin', username: 'adminuser' },
    });
    initializeSsmWebSocket(mockServer, mockLogger);

    // Connect 5 sessions (MAX_CONCURRENT_SESSIONS)
    for (let i = 0; i < 5; i++) {
      await mockWss.emit(
        'connection',
        mockWs,
        {},
        { instanceId: 'i-12345678', user: { username: 'admin' } }
      );
    }

    const mockSocket = { destroy: jest.fn(), write: jest.fn() };
    const mockRequest = {
      url: '/ws/ssm?instanceId=i-12345678',
      headers: { host: 'localhost', cookie: 'session_token=valid' },
    };

    await mockServer.emit('upgrade', mockRequest, mockSocket, Buffer.from(''));

    expect(mockSocket.write).toHaveBeenCalledWith(
      expect.stringContaining('HTTP/1.1 429 Too many active sessions')
    );
  });
});
