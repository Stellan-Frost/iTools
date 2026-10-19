import type { SsrRenderer } from '@itools/contracts';
import { DEFAULT_LOCALE, LOCALES } from '@itools/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  createSecurityHeadersHook,
  type SecurityHeadersOptions,
} from './headers.js';

const HTTPS_OPTIONS: SecurityHeadersOptions = {
  isProduction: true,
  siteOrigin: 'https://itools.example',
};

const HTTP_DEV_OPTIONS: SecurityHeadersOptions = {
  isProduction: false,
  siteOrigin: 'http://localhost:5173',
};

const TEMPLATE = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  '  <head>',
  '    <!--app-head-->',
  '  </head>',
  '  <body>',
  '    <div id="root"><!--app-html--></div>',
  '  </body>',
  '</html>',
].join('\n');

/** 取出单条指令（含指令名），便于只断言目标指令而不受其它值干扰。 */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split('; ')
    .find((entry) => entry === name || entry.startsWith(`${name} `));
}

function createStubRenderer(): SsrRenderer {
  return {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    async render(request) {
      return {
        statusCode: request.url.includes('missing') ? 404 : 200,
        lang: DEFAULT_LOCALE,
        headHtml: '<title>Test</title>',
        appHtml: '<main>Test</main>',
      };
    },
    async listSitemapUrls() {
      return [];
    },
  };
}

async function createHookApp(
  options: SecurityHeadersOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.addHook('onSend', createSecurityHeadersHook(options));
  app.get('/ok', async () => ({ ok: true }));
  app.get('/custom-csp', async (_request, reply) =>
    reply
      .header('content-security-policy', "default-src 'none'")
      .send('custom'),
  );
  await app.ready();
  return app;
}

describe('buildContentSecurityPolicy', () => {
  it('emits all production directives in stable order and keeps script-src strict', () => {
    const csp = buildContentSecurityPolicy(HTTPS_OPTIONS);

    expect(csp.split('; ')).toEqual([
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]);

    const scriptSrc = directive(csp, 'script-src');
    expect(scriptSrc).toBe("script-src 'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('keeps frame-ancestors, object-src and base-uri locked down in production', () => {
    const csp = buildContentSecurityPolicy(HTTPS_OPTIONS);

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('relaxes script-src and connect-src for Vite in development', () => {
    const csp = buildContentSecurityPolicy(HTTP_DEV_OPTIONS);

    const scriptSrc = directive(csp, 'script-src');
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'self'");

    const styleSrc = directive(csp, 'style-src');
    expect(styleSrc).toContain("'unsafe-inline'");

    const connectSrc = directive(csp, 'connect-src');
    expect(connectSrc).toContain('ws:');

    // 开发模式仍然保留安全兜底指令。
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});

describe('applySecurityHeaders', () => {
  it('sets the shared baseline headers on responses', async () => {
    const app = await createHookApp(HTTPS_OPTIONS);
    try {
      const response = await app.inject({ method: 'GET', url: '/ok' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
      );
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
      expect(response.headers['cross-origin-opener-policy']).toBe(
        'same-origin',
      );
      expect(response.headers['content-security-policy']).toBe(
        buildContentSecurityPolicy(HTTPS_OPTIONS),
      );
    } finally {
      await app.close();
    }
  });

  it('adds HSTS for https origins only', async () => {
    const httpsApp = await createHookApp(HTTPS_OPTIONS);
    const httpApp = await createHookApp(HTTP_DEV_OPTIONS);
    try {
      const httpsResponse = await httpsApp.inject({
        method: 'GET',
        url: '/ok',
      });
      expect(httpsResponse.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains',
      );

      const httpResponse = await httpApp.inject({ method: 'GET', url: '/ok' });
      expect(httpResponse.headers['strict-transport-security']).toBeUndefined();
    } finally {
      await httpsApp.close();
      await httpApp.close();
    }
  });

  it('does not overwrite a content-security-policy set by the route', async () => {
    const app = await createHookApp(HTTPS_OPTIONS);
    try {
      const response = await app.inject({ method: 'GET', url: '/custom-csp' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'",
      );
      // 其它安全头仍然补齐。
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    } finally {
      await app.close();
    }
  });

  it('returns the reply unchanged when applied directly', async () => {
    const app = Fastify({ logger: false });
    app.get('/direct', async (_request, reply) =>
      applySecurityHeaders(reply, HTTPS_OPTIONS).send('ok'),
    );
    try {
      const response = await app.inject({ method: 'GET', url: '/direct' });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBe(
        buildContentSecurityPolicy(HTTPS_OPTIONS),
      );
    } finally {
      await app.close();
    }
  });
});

describe('security headers on the real app', () => {
  it('applies headers to both 200 and 404 responses', async () => {
    const app = await createApp({
      renderer: createStubRenderer(),
      siteOrigin: HTTPS_OPTIONS.siteOrigin,
      getTemplate: async () => TEMPLATE,
    });
    app.addHook('onSend', createSecurityHeadersHook(HTTPS_OPTIONS));

    try {
      const okResponse = await app.inject({
        method: 'GET',
        url: '/robots.txt',
      });
      expect(okResponse.statusCode).toBe(200);
      expect(okResponse.headers['x-content-type-options']).toBe('nosniff');
      expect(okResponse.headers['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
      );
      expect(okResponse.headers['x-frame-options']).toBe('DENY');
      expect(okResponse.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
      expect(okResponse.headers['cross-origin-opener-policy']).toBe(
        'same-origin',
      );
      expect(okResponse.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      expect(okResponse.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains',
      );

      const missingResponse = await app.inject({
        method: 'GET',
        url: '/missing-page',
      });
      expect(missingResponse.statusCode).toBe(404);
      expect(missingResponse.headers['x-content-type-options']).toBe('nosniff');
      expect(missingResponse.headers['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
      );
      expect(missingResponse.headers['x-frame-options']).toBe('DENY');
      expect(missingResponse.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
      expect(missingResponse.headers['cross-origin-opener-policy']).toBe(
        'same-origin',
      );
      expect(missingResponse.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
    } finally {
      await app.close();
    }
  });
});
