#!/usr/bin/env node
/**
 * 源码级依赖边界检查：解析 apps/packages 的 import，强制执行包依赖方向。
 * 与 check-boundaries.mjs（只看 package.json）互补，防止绕过清单直接 import。
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** 工作区包依赖白名单；tool-* 由下方动态规则处理。 */
const ALLOWED = {
  '@itools/contracts': [],
  '@itools/app-core': ['@itools/contracts'],
  '@itools/design-system-adapter': [],
  '@itools/web': [
    '@itools/contracts',
    '@itools/app-core',
    '@itools/design-system-adapter',
  ],
  '@itools/server': ['@itools/contracts'],
};

const TOOL_ALLOWED = [
  '@itools/contracts',
  '@itools/app-core',
  '@itools/design-system-adapter',
];

async function collectWorkspacePackages() {
  const packages = [];
  for (const group of ['apps', 'packages']) {
    let entries;
    try {
      entries = await readdir(resolve(root, group), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = resolve(root, group, entry.name);
      try {
        const manifest = JSON.parse(
          await readFile(resolve(dir, 'package.json'), 'utf8'),
        );
        if (manifest.name?.startsWith('@itools/')) {
          packages.push({ name: manifest.name, dir });
        }
      } catch {
        // 没有 package.json 的目录忽略
      }
    }
  }
  return packages;
}

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
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const IMPORT_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function importsOf(source) {
  const specifiers = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return specifiers;
}

function allowedFor(packageName) {
  if (packageName.startsWith('@itools/tool-')) return TOOL_ALLOWED;
  return ALLOWED[packageName] ?? [];
}

const packages = await collectWorkspacePackages();
const errors = [];

for (const pkg of packages) {
  const allowed = allowedFor(pkg.name);
  for (const file of await collectFiles(pkg.dir)) {
    const source = await readFile(file, 'utf8');
    for (const specifier of importsOf(source)) {
      if (specifier.startsWith('@itools/')) {
        const target = specifier.split('/').slice(0, 2).join('/');
        if (target === pkg.name) {
          errors.push(
            `${relative(root, file)}: 不得通过包名自引用 ${target}，请使用相对路径`,
          );
          continue;
        }
        if (!allowed.includes(target)) {
          errors.push(
            `${relative(root, file)}: ${pkg.name} 不得依赖 ${target}`,
          );
        }
        continue;
      }

      if (!specifier.startsWith('.')) continue;

      const targetPath = resolve(dirname(file), specifier);
      if (targetPath !== pkg.dir && !targetPath.startsWith(pkg.dir + sep)) {
        errors.push(`${relative(root, file)}: 相对导入越出包边界 ${specifier}`);
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  console.error(`\n源码依赖边界检查失败：${errors.length} 项。`);
  process.exit(1);
}

console.log(
  `源码依赖边界检查通过：${packages.length} 个包，方向符合 docs/00。`,
);
