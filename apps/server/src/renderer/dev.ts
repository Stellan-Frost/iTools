import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type SsrRenderRequest,
  type SsrRenderResult,
  type SsrRenderer,
} from '@itools/contracts';
import { createServer, type ViteDevServer } from 'vite';

interface ServerEntry {
  render(request: SsrRenderRequest): Promise<SsrRenderResult>;
  listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
}

export interface DevRenderer {
  readonly renderer: SsrRenderer;
  getTemplate(url: string): Promise<string>;
  readonly middlewares: ViteDevServer['middlewares'];
  close(): Promise<void>;
}

const ENTRY_PATH = '/src/entry-server.tsx';

/** 开发环境：Vite middleware 提供模块转换与 SSR 模块加载。 */
export async function createDevRenderer(webRoot: string): Promise<DevRenderer> {
  const vite = await createServer({
    root: webRoot,
    configFile: path.join(webRoot, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const loadEntry = async (): Promise<ServerEntry> => {
    const module = await vite.ssrLoadModule(ENTRY_PATH);
    if (
      typeof module.render !== 'function' ||
      typeof module.listSitemapUrls !== 'function'
    ) {
      throw new Error(
        `SSR entry ${ENTRY_PATH} must export render() and listSitemapUrls().`,
      );
    }
    return module as unknown as ServerEntry;
  };

  const renderer: SsrRenderer = {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    async render(request) {
      const entry = await loadEntry();
      return entry.render(request);
    },
    async listSitemapUrls(siteOrigin) {
      const entry = await loadEntry();
      return entry.listSitemapUrls(siteOrigin);
    },
  };

  return {
    renderer,
    async getTemplate(url) {
      const template = await readFile(path.join(webRoot, 'index.html'), 'utf8');
      return vite.transformIndexHtml(url, template);
    },
    middlewares: vite.middlewares,
    close: () => vite.close(),
  };
}
