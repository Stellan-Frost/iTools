import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const allowedWorkspaceDependencies = {
  '@itools/contracts': new Set(),
  '@itools/app-core': new Set(['@itools/contracts']),
  '@itools/task-runtime': new Set(['@itools/contracts']),
  '@itools/asset-store': new Set(['@itools/contracts']),
  '@itools/design-system-adapter': new Set(),
  '@itools/db': new Set(['@itools/contracts', '@itools/app-core']),
  '@itools/web': new Set([
    '@itools/contracts',
    '@itools/app-core',
    '@itools/design-system-adapter',
  ]),
  '@itools/server': new Set(['@itools/contracts', '@itools/db']),
};

async function workspaceManifests() {
  const manifests = [];
  for (const group of ['apps', 'packages']) {
    let entries;
    try {
      entries = await readdir(group, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = join(group, entry.name, 'package.json');
      try {
        manifests.push({
          file,
          manifest: JSON.parse(await readFile(file, 'utf8')),
        });
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  return manifests;
}

let hasError = false;
for (const { file, manifest } of await workspaceManifests()) {
  const allowed = manifest.name?.startsWith('@itools/tool-')
    ? new Set([
        '@itools/contracts',
        '@itools/app-core',
        '@itools/design-system-adapter',
      ])
    : allowedWorkspaceDependencies[manifest.name];
  if (!allowed) {
    console.error(`${file}: 未声明的工作区包 ${manifest.name}`);
    hasError = true;
    continue;
  }
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ]) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (dependency.startsWith('@itools/') && !allowed.has(dependency)) {
        console.error(`${file}: ${manifest.name} 不得依赖 ${dependency}`);
        hasError = true;
      }
    }
  }
}

if (hasError) process.exitCode = 1;
