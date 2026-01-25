// Test raw TCP socket to PostgreSQL
const net = require('net');

console.log('Testing raw TCP socket connection to PostgreSQL...');

const socket = net.createConnection({
  host: '127.0.0.1',
  port: 5432,
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('✓ TCP socket connected successfully!');
  console.log('✓ This proves Node.js CAN reach PostgreSQL at TCP level');
  socket.destroy();
  process.exit(0);
});

socket.on('timeout', () => {
  console.error('✗ TCP socket timed out');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.error('✗ TCP socket error:', err.message);
  process.exit(1);
});

socket.on('close', () => {
  console.log('Socket closed');
});
