#!/usr/bin/env node
/**
 * 外部资源审计：构建产物只能加载同源资源。
 * CSP 默认拒绝外部源，这里用静态扫描把「不得引入未审核外部资源」变成可重复门禁。
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** 需要扫描的构建产物目录（相对仓库根）。 */
const TARGETS = ['apps/web/dist/client'];

const PATTERNS = [
  { pattern: /(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/g, label: 'HTML 引用' },
  { pattern: /url\(\s*['"]?(https?:\/\/[^)'"]+)/g, label: 'CSS url()' },
];

async function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, files);
    } else if (/\.(html|css)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
let scanned = 0;

for (const target of TARGETS) {
  for (const file of await collectFiles(resolve(root, target))) {
    scanned += 1;
    const source = await readFile(file, 'utf8');
    for (const { pattern, label } of PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        violations.push(
          `${relative(root, file)}: ${label} 指向外部资源 ${match[1]}`,
        );
      }
    }
  }
}

if (scanned === 0) {
  console.error('外部资源审计失败：未找到构建产物，请先 pnpm build。');
  process.exit(1);
}

if (violations.length > 0) {
  for (const violation of violations) console.error(violation);
  console.error(`\n外部资源审计失败：${violations.length} 处外部引用。`);
  process.exit(1);
}

console.log(`外部资源审计通过：${scanned} 个 HTML/CSS 文件无外部引用。`);
