/**
 * 最小 Cookie 读写：不引入 `@fastify/cookie`，避免新增依赖。
 * 只处理本项目需要的属性组合（Path、Max-Age、HttpOnly、SameSite、Secure）。
 */

export interface SetCookieOptions {
  readonly maxAgeSeconds: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
}

export type ClearCookieOptions = Omit<SetCookieOptions, 'maxAgeSeconds'>;

const ATTRIBUTE_PATH = 'Path=/';
const ATTRIBUTE_SAME_SITE = 'SameSite=Strict';

/**
 * 解析请求 Cookie 头：忽略空段，名称与值两侧空白去掉，
 * 无值的键记为 `''`，重复键保留第一次出现的值。
 */
export function parseCookies(
  header: string | undefined,
): Readonly<Record<string, string>> {
  const parsed = new Map<string, string>();
  if (header === undefined || header.length === 0) {
    return Object.fromEntries(parsed);
  }

  for (const segment of header.split(';')) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    const name = (
      separator === -1 ? trimmed : trimmed.slice(0, separator)
    ).trim();
    if (name.length === 0) {
      continue;
    }
    if (parsed.has(name)) {
      continue;
    }

    const value = separator === -1 ? '' : trimmed.slice(separator + 1).trim();
    parsed.set(name, value);
  }

  return Object.fromEntries(parsed);
}

/**
 * 属性顺序固定，便于测试与抓包比对：
 * `name=value; Path=/; Max-Age=…; HttpOnly?; SameSite=Strict; Secure?`
 */
export function buildSetCookie(
  name: string,
  value: string,
  options: SetCookieOptions,
): string {
  const maxAgeSeconds = Math.max(0, Math.floor(options.maxAgeSeconds));
  const segments = [
    `${name}=${value}`,
    ATTRIBUTE_PATH,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }
  segments.push(ATTRIBUTE_SAME_SITE);
  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
}

export function buildClearCookie(
  name: string,
  options: ClearCookieOptions,
): string {
  return buildSetCookie(name, '', { ...options, maxAgeSeconds: 0 });
}
