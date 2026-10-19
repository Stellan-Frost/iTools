import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createRequestLogger,
  formatRequestLog,
  type RequestLogEntry,
  type RequestLoggerOptions,
} from './request-log.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('期望一个 JSON 对象');
  }
  return value as Record<string, unknown>;
}

function parseEntry(line: string): RequestLogEntry {
  const record = asRecord(JSON.parse(line));
  const { time, requestId, method, path, status, durationMs } = record;
  if (
    typeof time !== 'string' ||
    typeof requestId !== 'string' ||
    typeof method !== 'string' ||
    typeof path !== 'string' ||
    typeof status !== 'number' ||
    typeof durationMs !== 'number'
  ) {
    throw new Error('日志字段缺失或类型不符');
  }
  return { time, requestId, method, path, status, durationMs };
}

function firstLine(lines: readonly string[]): string {
  const line = lines[0];
  if (line === undefined) {
    throw new Error('未写入任何日志');
  }
  return line;
}

function createApp(options: RequestLoggerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  app.addHook('onResponse', createRequestLogger(options));
  apps.push(app);
  return app;
}

describe('formatRequestLog', () => {
  it('输出固定键顺序的单行 JSON', () => {
    const line = formatRequestLog({
      time: '2026-01-02T03:04:05.000Z',
      requestId: 'req-1',
      method: 'GET',
      path: '/tools',
      status: 200,
      durationMs: 7,
    });

    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      time: '2026-01-02T03:04:05.000Z',
      requestId: 'req-1',
      method: 'GET',
      path: '/tools',
      status: 200,
      durationMs: 7,
    });

    const keyOrder = [
      '"time"',
      '"requestId"',
      '"method"',
      '"path"',
      '"status"',
      '"durationMs"',
    ].map((key) => line.indexOf(key));
    expect(keyOrder.every((index) => index >= 0)).toBe(true);
    expect([...keyOrder].sort((a, b) => a - b)).toEqual(keyOrder);
  });
});

describe('createRequestLogger', () => {
  it('记录必要字段与正确的状态码', async () => {
    const lines: string[] = [];
    const app = createApp({
      write: (line) => {
        lines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.get('/hello', async () => ({ ok: true }));

    const response = await app.inject({ method: 'GET', url: '/hello' });

    expect(response.statusCode).toBe(200);
    expect(lines).toHaveLength(1);

    const entry = parseEntry(firstLine(lines));
    expect(entry).toEqual({
      time: '2026-01-02T03:04:05.000Z',
      requestId: expect.any(String),
      method: 'GET',
      path: '/hello',
      status: 200,
      durationMs: expect.any(Number),
    });
    expect(entry.requestId.length).toBeGreaterThan(0);
    expect(Number.isInteger(entry.durationMs)).toBe(true);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('丢弃查询串，不泄露敏感参数', async () => {
    const lines: string[] = [];
    const app = createApp({
      write: (line) => {
        lines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.get('/secure', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/secure?token=secret&redirect=%2Fadmin',
    });

    expect(response.statusCode).toBe(200);
    const line = firstLine(lines);
    expect(parseEntry(line).path).toBe('/secure');
    expect(line).not.toContain('secret');
    expect(line).not.toContain('token');
    expect(line).not.toContain('?');
  });

  it('不记录 cookie 与 authorization 头', async () => {
    const lines: string[] = [];
    const app = createApp({
      write: (line) => {
        lines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.get('/private', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'GET',
      url: '/private',
      headers: {
        cookie: 'session=cookie-secret',
        authorization: 'Bearer auth-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    const line = firstLine(lines);
    expect(line).not.toContain('cookie-secret');
    expect(line).not.toContain('auth-secret');
    expect(line.toLowerCase()).not.toContain('cookie');
    expect(line.toLowerCase()).not.toContain('authorization');
  });

  it('requestId 与服务端 request.id 一致', async () => {
    const lines: string[] = [];
    const app = createApp({
      write: (line) => {
        lines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.get('/identity', async (request) => ({ id: request.id }));

    const response = await app.inject({ method: 'GET', url: '/identity' });
    const body = asRecord(JSON.parse(response.body));
    expect(typeof body['id']).toBe('string');

    expect(parseEntry(firstLine(lines)).requestId).toBe(body['id']);
  });

  it('低于 slowThresholdMs 不写日志，高于阈值写入', async () => {
    const fastLines: string[] = [];
    const fastApp = createApp({
      write: (line) => {
        fastLines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
      slowThresholdMs: 1000,
    });
    fastApp.get('/fast', async () => ({ ok: true }));

    const fastResponse = await fastApp.inject({ method: 'GET', url: '/fast' });
    expect(fastResponse.statusCode).toBe(200);
    expect(fastLines).toHaveLength(0);

    const slowLines: string[] = [];
    const slowApp = createApp({
      write: (line) => {
        slowLines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
      slowThresholdMs: 5,
    });
    slowApp.get('/slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true };
    });

    const slowResponse = await slowApp.inject({ method: 'GET', url: '/slow' });
    expect(slowResponse.statusCode).toBe(200);
    expect(slowLines).toHaveLength(1);
    expect(parseEntry(firstLine(slowLines)).durationMs).toBeGreaterThanOrEqual(
      5,
    );
  });

  it('write 抛错时请求仍正常返回且只尝试一次', async () => {
    let attempts = 0;
    const app = createApp({
      write: () => {
        attempts += 1;
        throw new Error('stdout closed');
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.get('/ok', async () => ({ ok: true }));

    const response = await app.inject({ method: 'GET', url: '/ok' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(attempts).toBe(1);
  });

  it('POST 请求不记录 JSON body', async () => {
    const lines: string[] = [];
    const app = createApp({
      write: (line) => {
        lines.push(line);
      },
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
    app.post('/echo', async () => ({ received: true }));

    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      payload: { secret: 'body-secret', token: 'body-token' },
    });

    expect(response.statusCode).toBe(200);
    const line = firstLine(lines);
    const entry = parseEntry(line);
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/echo');
    expect(line).not.toContain('body-secret');
    expect(line).not.toContain('body-token');
  });
});
