import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type SsrRenderRequest,
  type SsrRenderResult,
  type SsrRenderer,
} from '@itools/contracts';

interface ServerEntry {
  render(request: SsrRenderRequest): Promise<SsrRenderResult>;
  listSitemapUrls(siteOrigin: string): Promise<readonly string[]>;
}

export interface ProdRenderer {
  readonly renderer: SsrRenderer;
  getTemplate(url: string): Promise<string>;
}

/** 生产环境：从 WEB_ROOT/dist 加载已构建的 SSR 模块与客户端模板。 */
export async function createProdRenderer(
  webRoot: string,
): Promise<ProdRenderer> {
  const entryPath = path.join(webRoot, 'dist', 'server', 'entry-server.js');
  const templatePath = path.join(webRoot, 'dist', 'client', 'index.html');

  const module: unknown = await import(pathToFileURL(entryPath).href);
  const entry = assertServerEntry(module);

  let template: string | undefined;

  const renderer: SsrRenderer = {
    supportedLocales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    render: (request) => entry.render(request),
    listSitemapUrls: (siteOrigin) => entry.listSitemapUrls(siteOrigin),
  };

  return {
    renderer,
    async getTemplate() {
      if (template === undefined) {
        template = await readFile(templatePath, 'utf8');
      }
      return template;
    },
  };
}

function assertServerEntry(module: unknown): ServerEntry {
  if (typeof module !== 'object' || module === null) {
    throw new Error('Built SSR entry is not a module object.');
  }
  const candidate = module as { render?: unknown; listSitemapUrls?: unknown };
  if (
    typeof candidate.render !== 'function' ||
    typeof candidate.listSitemapUrls !== 'function'
  ) {
    throw new Error(
      'Built SSR entry must export render() and listSitemapUrls().',
    );
  }
  return candidate as ServerEntry;
}
