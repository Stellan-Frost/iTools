import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/design-system-adapter/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['apps/web/public/sw*.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // 全仓库通用的严格规则
    files: ['apps/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // 生产源码单文件上限；测试文件不受此限制
    files: ['apps/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-lines': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // 禁止裸 HTML 交互控件（页面与组件必须使用适配层）
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]',
          message:
            '禁止裸 HTML 控件；请使用 @itools/design-system-adapter 组件。',
        },
      ],
    },
  },
  {
    // Web 不得绕过适配层直接使用组件库或深层 src 路径
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'm3-expressive-react',
              message:
                '请从 @itools/design-system-adapter 导入，不要直接使用组件库。',
            },
          ],
          patterns: [
            {
              group: ['@itools/*/src/*', '@itools/*/dist/*'],
              message: '不得深层导入其它包源码或构建产物，请使用包入口。',
            },
          ],
        },
      ],
    },
  },
  {
    // 服务端只能依赖 contracts
    files: ['apps/server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@itools/app-core',
                '@itools/design-system-adapter',
                '@itools/web',
              ],
              message: 'apps/server 只能依赖 @itools/contracts 与 @itools/db。',
            },
          ],
        },
      ],
    },
  },
  {
    // contracts 是纯共享层，不得依赖任何工作区包或 Node/浏览器实现
    files: ['packages/contracts/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@itools/*', 'node:*'],
              message: 'contracts 不得依赖工作区包或运行时环境。',
            },
          ],
        },
      ],
    },
  },
);
