import { spawn } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const encode = values => `*${values.length}\r\n${values.map(value => { const s = String(value); return `$${Buffer.byteLength(s)}\r\n${s}\r\n`; }).join('')}`;
const incomplete = Symbol('incomplete');
const parse = (buffer, start = 0) => {
  const end = buffer.indexOf('\r\n', start);
  if (end < 0) return incomplete;
  const type = String.fromCharCode(buffer[start]), value = buffer.toString('utf8', start + 1, end);
  let offset = end + 2;
  if (type === '+' || type === ':') return [type === ':' ? Number(value) : value, offset];
  if (type === '-') return [new Error(value), offset];
  const length = Number(value);
  if (length === -1) return [null, offset];
  if (type === '$') {
    if (buffer.length < offset + length + 2) return incomplete;
    return [buffer.toString('utf8', offset, offset + length), offset + length + 2];
  }
  if (type === '*') {
    const values = [];
    for (let i = 0; i < length; i++) {
      const p = parse(buffer, offset); if (p === incomplete) return incomplete;
      values.push(p[0]); offset = p[1];
    }
    return [values, offset];
  }
  throw new Error(`Unknown Redis response type ${type}`);
};

// Real Redis binds only to loopback on an ephemeral port, with persistence disabled.
export const redisFixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'geek-duel-'));
  const reserve = createServer();
  reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const process = spawn(globalThis.process.env.REDIS_SERVER_BIN || 'redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--dir', directory, '--save', '', '--appendonly', 'no'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let failure = null, ready = false;
  process.stdout.on('data', value => { if (String(value).includes('Ready to accept connections')) ready = true; });
  process.on('error', error => { failure = error; });
  for (let i = 0; i < 100; i++) {
    if (failure) { await rm(directory, { recursive: true, force: true }); throw failure; }
    if (ready) break;
    if (process.exitCode !== null) throw new Error('Redis fixture exited before startup');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const commands = values => new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let buffer = Buffer.alloc(0); const results = [];
    socket.setTimeout(10_000, () => socket.destroy(new Error('Redis fixture timeout')));
    socket.on('error', reject);
    socket.on('connect', () => socket.write(values.map(encode).join('')));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (results.length < values.length) {
        const parsed = parse(buffer); if (parsed === incomplete) return;
        buffer = buffer.subarray(parsed[1]);
        if (parsed[0] instanceof Error) { socket.destroy(); reject(parsed[0]); return; }
        results.push(parsed[0]);
      }
      socket.end(); resolve(results);
    });
  });
  const command = async (...values) => (await commands([values]))[0];
  await command('PING');
  return { command, commands, close: async () => {
    const closed = once(process, 'exit'); process.kill(); await closed;
    await rm(directory, { recursive: true, force: true });
  } };
};
