import type { FastifyReply, onSendHookHandler } from 'fastify';

export interface SecurityHeadersOptions {
  /** 生产环境启用严格 CSP；开发环境需要放宽以兼容 Vite。 */
  readonly isProduction: boolean;
  /** 站点来源，例如 https://itools.wataa.men 或 http://localhost:5173。 */
  readonly siteOrigin: string;
}

const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

/** 除 CSP 与 HSTS 外，生产与开发环境共用的基础响应头。 */
const BASE_HEADERS: readonly (readonly [string, string])[] = [
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['x-frame-options', 'DENY'],
  [
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  ],
  ['cross-origin-opener-policy', 'same-origin'],
];

/**
 * 生成 CSP 字符串，指令顺序固定，便于快照与审查。
 *
 * 已知取舍：style-src 保留 'unsafe-inline'。MD3 组件库会在元素上输出内联
 * style 属性（尺寸、主题变量等），CSP 的 nonce/hash 无法覆盖属性级内联样式，
 * 因此只能放宽；同时模板本身也依赖内联样式，收紧会导致整站样式失效。
 * script-src 在生产环境仍保持严格 'self'，不继承该放宽。
 */
export function buildContentSecurityPolicy(
  options: SecurityHeadersOptions,
): string {
  const directives: readonly string[] = [
    "default-src 'self'",
    options.isProduction
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    options.isProduction ? "connect-src 'self'" : "connect-src 'self' ws:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // 开发环境额外放宽 script-src：Vite 会注入内联 module 脚本；
  // connect-src 追加 ws: 以允许 HMR WebSocket。安全兜底指令保持存在。
  return directives.join('; ');
}

/**
 * 写入安全响应头。已存在的同名头保持业务值，不覆盖。
 */
export function applySecurityHeaders(
  reply: FastifyReply,
  options: SecurityHeadersOptions,
): FastifyReply {
  for (const [name, value] of BASE_HEADERS) {
    if (!reply.hasHeader(name)) {
      reply.header(name, value);
    }
  }

  if (!reply.hasHeader('content-security-policy')) {
    reply.header(
      'content-security-policy',
      buildContentSecurityPolicy(options),
    );
  }

  if (
    isHttpsOrigin(options.siteOrigin) &&
    !reply.hasHeader('strict-transport-security')
  ) {
    reply.header('strict-transport-security', HSTS_VALUE);
  }

  return reply;
}

/** 仅在 HTTPS 站点下声明 HSTS；http（含本地开发）不得下发。 */
export function createSecurityHeadersHook(
  options: SecurityHeadersOptions,
): onSendHookHandler {
  return (_request, reply, payload, done) => {
    applySecurityHeaders(reply, options);
    done(null, payload);
  };
}

function isHttpsOrigin(siteOrigin: string): boolean {
  return siteOrigin.trim().toLowerCase().startsWith('https:');
}
