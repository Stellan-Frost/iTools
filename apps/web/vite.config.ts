import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

type CacheBucket = 'precache' | 'engines';

interface ServiceWorkerManifestAsset {
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly cache: CacheBucket;
}

interface ServiceWorkerManifest {
  readonly schemaVersion: 1;
  readonly buildId: string;
  readonly assets: readonly ServiceWorkerManifestAsset[];
}

const buildId = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return paths.flat();
}

function isFontAsset(fileName: string): boolean {
  return /\.(?:woff2?|ttf|otf)$/i.test(fileName);
}

function cacheBucket(fileName: string): CacheBucket {
  return /engine|\.wasm$/i.test(fileName) ? 'engines' : 'precache';
}

function publicAssetUrl(fileName: string): string {
  return `/${fileName.split('/').map(encodeURIComponent).join('/')}`;
}

function shouldPrecache(fileName: string): boolean {
  return (
    fileName !== 'index.html' &&
    fileName !== 'sw.js' &&
    fileName !== 'sw-core.js' &&
    fileName !== 'sw-offline.js' &&
    fileName !== 'sw-manifest.json' &&
    !fileName.endsWith('.map') &&
    !isFontAsset(fileName)
  );
}

function pwaBuildPlugin(): Plugin {
  let isSsrBuild = false;
  let publicDirectory = '';
  let outputDirectory = '';

  return {
    name: 'itools-pwa-build',
    apply: 'build',
    configResolved(config) {
      isSsrBuild = Boolean(config.build.ssr);
      publicDirectory = config.publicDir;
      outputDirectory = isAbsolute(config.build.outDir)
        ? config.build.outDir
        : resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      if (isSsrBuild) return html;
      return html.replace(
        '<!--pwa-build-id-->',
        `<meta name="itools-build-id" content="${buildId}" />`,
      );
    },
    async generateBundle() {
      if (isSsrBuild) return;

      const [bootstrap, coreTemplate, offlineSource] = await Promise.all([
        readFile(join(publicDirectory, 'sw.js'), 'utf8'),
        readFile(join(publicDirectory, 'sw-core.js'), 'utf8'),
        readFile(join(publicDirectory, 'sw-offline.js'), 'utf8'),
      ]);
      const coreSource = coreTemplate.replace(
        /(['"])__ITOOLS_BUILD_ID__\1/,
        JSON.stringify(buildId),
      );
      if (coreSource === coreTemplate) {
        this.error('The service worker buildId marker was not found.');
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: bootstrap });
      this.emitFile({
        type: 'asset',
        fileName: 'sw-core.js',
        source: coreSource,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sw-offline.js',
        source: offlineSource,
      });

      const manifest: ServiceWorkerManifest = {
        schemaVersion: 1,
        buildId,
        assets: [],
      };

      this.emitFile({
        type: 'asset',
        fileName: 'sw-manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
    async writeBundle() {
      if (isSsrBuild) return;

      const manifestPath = join(outputDirectory, 'sw-manifest.json');
      const outputFiles = await listFiles(outputDirectory);
      const assets = await Promise.all(
        outputFiles
          .map((path) => relative(outputDirectory, path).split(sep).join('/'))
          .filter(shouldPrecache)
          .map(async (fileName) =>
            createManifestAsset(
              fileName,
              await readFile(join(outputDirectory, fileName)),
            ),
          ),
      );
      assets.sort((left, right) => left.url.localeCompare(right.url));
      const verifiedManifest: ServiceWorkerManifest = {
        schemaVersion: 1,
        buildId,
        assets,
      };
      await writeFile(
        manifestPath,
        `${JSON.stringify(verifiedManifest, null, 2)}\n`,
      );
    },
  };
}

function createManifestAsset(
  fileName: string,
  bytes: Uint8Array,
): ServiceWorkerManifestAsset {
  return {
    url: publicAssetUrl(fileName),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
    cache: cacheBucket(fileName),
  };
}

export default defineConfig({
  plugins: [react(), pwaBuildPlugin()],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  ssr: {
    // 这些包在 Node ESM 下不能安全外置（D15）：省略扩展名的内部导入会导致 SSR 失败。
    noExternal: [
      'm3-expressive-react',
      '@itools/design-system-adapter',
      '@material/material-color-utilities',
      '@itools/app-core',
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: [
          '@itools/design-system-adapter',
          'm3-expressive-react',
          '@material/material-color-utilities',
        ],
      },
    },
  },
});
