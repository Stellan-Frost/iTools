import middie from '@fastify/middie';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { createCatalogRuntime } from './catalog-runtime.js';
import { loadConfig, type ServerConfig } from './config.js';

interface Runtime {
  readonly app: FastifyInstance;
  closeRenderer?: () => Promise<void>;
  closeCatalog?: () => Promise<void>;
}

async function createRuntime(config: ServerConfig): Promise<Runtime> {
  const catalogRuntime = createCatalogRuntime({
    ...(config.databaseUrl === undefined
      ? {}
      : { databaseUrl: config.databaseUrl }),
    ...(config.adminSetupToken === undefined
      ? {}
      : { adminSetupToken: config.adminSetupToken }),
    secureCookies: config.siteOrigin.startsWith('https://'),
  });
  const api = {
    catalog: catalogRuntime.catalog,
    ...(catalogRuntime.probeDatabase === undefined
      ? {}
      : { probeDatabase: catalogRuntime.probeDatabase }),
  };
  // 管理写接口额外做来源校验，只接受站点自身发起的请求。
  const admin =
    catalogRuntime.admin === undefined
      ? undefined
      : { ...catalogRuntime.admin, allowedOrigin: config.siteOrigin };
  const isProduction = config.mode === 'production';
  const logRequests = isProduction
    ? {
        write: (line: string) => process.stdout.write(`${line}\n`),
        now: () => new Date(),
      }
    : undefined;

  if (config.mode === 'development') {
    const { createDevRenderer } = await import('./renderer/dev.js');
    const dev = await createDevRenderer(config.webRoot);

    const app = await createApp({
      renderer: dev.renderer,
      siteOrigin: config.siteOrigin,
      getTemplate: dev.getTemplate,
      api,
      isProduction,
      ...(logRequests === undefined ? {} : { logRequests }),
      ...(admin === undefined ? {} : { admin }),
      registerDevMiddleware: async (instance) => {
        // middie 的 decorate 在插件加载后才生效，因此把 use 推迟到 after 回调。
        instance.register(middie);
        instance.after(() => {
          instance.use(dev.middlewares);
        });
      },
    });

    return {
      app,
      closeRenderer: dev.close,
      closeCatalog: catalogRuntime.close,
    };
  }

  const { createProdRenderer } = await import('./renderer/prod.js');
  const prod = await createProdRenderer(config.webRoot);
  const app = await createApp({
    renderer: prod.renderer,
    siteOrigin: config.siteOrigin,
    getTemplate: prod.getTemplate,
    api,
    isProduction,
    ...(logRequests === undefined ? {} : { logRequests }),
    ...(admin === undefined ? {} : { admin }),
    staticRoots: {
      assets: `${config.webRoot}/dist/client/assets`,
      brandIcons: `${config.webRoot}/dist/client/brand-icon`,
      pwa: `${config.webRoot}/dist/client`,
    },
  });

  return { app, closeCatalog: catalogRuntime.close };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const runtime = await createRuntime(config);
  let shuttingDown = false;

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await runtime.app.close();
    } finally {
      await runtime.closeRenderer?.();
      await runtime.closeCatalog?.();
    }
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  await runtime.app.listen({ host: config.host, port: config.port });
  process.stdout.write(
    `@itools/server listening on http://${config.host}:${config.port} (${config.mode})\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`@itools/server failed to start: ${message}\n`);
  process.exitCode = 1;
});
