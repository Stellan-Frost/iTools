#!/usr/bin/env node
/**
 * 设计 Token 检查：Web 代码不得出现硬编码颜色、内联样式或 !important。
 * 颜色必须来自语义变量；样式必须放在 CSS Module。
 */
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const webSrc = resolve(root, 'apps/web/src');

async function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, files);
    } else if (
      /\.(css|ts|tsx)$/.test(entry.name) &&
      !/\.test\./.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

const rules = [
  {
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    message:
      '禁止硬编码十六进制颜色，请使用 --md-sys-color-* 或 --itools-* Token',
  },
  {
    pattern: /\brgba?\(/g,
    message: '禁止硬编码 rgb/rgba 颜色，请使用语义 Token',
  },
  {
    pattern: /\bhsla?\(/g,
    message: '禁止硬编码 hsl/hsla 颜色，请使用语义 Token',
  },
  {
    pattern: /!important/g,
    message: '禁止 !important；不得覆盖组件库内部样式',
  },
];

const errors = [];

for (const file of await collectFiles(webSrc)) {
  const source = await readFile(file, 'utf8');
  const displayName = relative(root, file);

  for (const rule of rules) {
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      errors.push(`${displayName}:${line} ${rule.message}`);
    }
  }

  if (/\.tsx$/.test(file) && /\bstyle=\{\{/.test(source)) {
    errors.push(
      `${displayName} 使用了内联 style；请改为 CSS Module 并引用 Token`,
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  console.error(`\n设计 Token 检查失败：${errors.length} 项。`);
  process.exit(1);
}

console.log('设计 Token 检查通过：无硬编码颜色、内联样式或 !important。');
