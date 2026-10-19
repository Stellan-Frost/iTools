import path from 'node:path';

export type ServerMode = 'development' | 'production';

export interface ServerConfig {
  readonly mode: ServerMode;
  readonly host: string;
  readonly port: number;
  readonly siteOrigin: string;
  readonly webRoot: string;
}

const DEFAULT_PORT = 5173;
const DEFAULT_SITE_ORIGIN = 'http://localhost:5173';
const DEFAULT_WEB_ROOT = '../web';

/**
 * 读取并校验服务端环境变量。错误信息只说明约束，不回显变量值。
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const mode = readMode(env.NODE_ENV);
  const host = readHost(env.HOST);
  const port = readPort(env.PORT);
  const siteOrigin = readSiteOrigin(env.SITE_ORIGIN);
  const webRoot = readWebRoot(env.WEB_ROOT);

  return { mode, host, port, siteOrigin, webRoot };
}

function readMode(raw: string | undefined): ServerMode {
  const value = raw === undefined ? 'development' : raw;
  if (value !== 'development' && value !== 'production') {
    throw new Error('NODE_ENV must be either "development" or "production".');
  }
  return value;
}

function readHost(raw: string | undefined): string {
  const value = raw === undefined ? '127.0.0.1' : raw.trim();
  if (value === '') {
    throw new Error('HOST must not be empty.');
  }
  return value;
}

function readPort(raw: string | undefined): number {
  const value = raw === undefined ? String(DEFAULT_PORT) : raw.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

function readSiteOrigin(raw: string | undefined): string {
  const value = raw === undefined ? DEFAULT_SITE_ORIGIN : raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SITE_ORIGIN must be a valid absolute URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SITE_ORIGIN must use http or https.');
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(
      'SITE_ORIGIN must contain only an origin (no path, query, hash, or credentials).',
    );
  }
  return url.origin;
}

function readWebRoot(raw: string | undefined): string {
  const value = raw === undefined ? DEFAULT_WEB_ROOT : raw.trim();
  if (value === '') {
    throw new Error('WEB_ROOT must not be empty.');
  }
  return path.resolve(process.cwd(), value);
}
