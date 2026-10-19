#!/usr/bin/env node
/**
 * i18n 键使用检查：资源中的每个叶子键都必须被 apps/web 引用。
 * 前置：先构建 @itools/app-core（或 pnpm build），脚本读取 dist 资源。
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distEntry = new URL(
  '../packages/app-core/dist/index.js',
  import.meta.url,
);

if (!existsSync(distEntry)) {
  console.error('未找到 @itools/app-core 构建产物；请先执行 pnpm build。');
  process.exit(1);
}

const { resources } = await import(distEntry.href);

async function collectSources(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await collectSources(path, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function leaves(node, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      keys.push(...leaves(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const sources = await collectSources(resolve(root, 'apps/web/src'));
const sourceText = (
  await Promise.all(sources.map((file) => readFile(file, 'utf8')))
).join('\n');

const unused = [];
for (const namespace of Object.keys(resources.en)) {
  for (const key of leaves(resources.en[namespace])) {
    const used =
      sourceText.includes(`${namespace}:${key}`) ||
      sourceText.includes(`'${key}'`) ||
      sourceText.includes(`"${key}"`);
    if (!used) unused.push(`${namespace}:${key}`);
  }
}

if (unused.length > 0) {
  for (const key of unused) console.error(`未使用的 i18n 键：${key}`);
  console.error(`\ni18n 检查失败：${unused.length} 个键没有引用。`);
  process.exit(1);
}

console.log('i18n 检查通过：所有资源键都有引用。');
