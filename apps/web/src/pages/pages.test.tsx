import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '@itools/app-core';
import type { Locale } from '@itools/contracts';
import {
  AppThemeProvider,
  SnackbarProvider,
} from '@itools/design-system-adapter';
import {
  AppNavigationProvider,
  type AppNavigation,
} from '../app/navigation.js';
import { AdminPage } from './admin/AdminPage.js';
import { CategoryPage } from './category/CategoryPage.js';
import { HomePage } from './home/HomePage.js';
import { NotFoundPage } from './not-found/NotFoundPage.js';
import { TasksPage } from './tasks/TasksPage.js';
import { ToolPage } from './tool/ToolPage.js';

const CJK_PATTERN = /[\u4e00-\u9fff]/;

function renderPage(page: ReactNode, locale: Locale) {
  const navigation: AppNavigation = {
    locale,
    route: { page: 'home' },
    navigate: vi.fn(),
    switchLocale: vi.fn(),
    openSearch: vi.fn(),
  };

  const result = render(
    <I18nextProvider i18n={createI18n(locale)}>
      <AppThemeProvider mode="light">
        <SnackbarProvider>
          <AppNavigationProvider value={navigation}>
            {page}
          </AppNavigationProvider>
        </SnackbarProvider>
      </AppThemeProvider>
    </I18nextProvider>,
  );

  return { ...result, navigation };
}

afterEach(() => {
  cleanup();
});

describe('stage 3 pages · 中文', () => {
  it('首页展示 5 个分类与 6 个启用工具，且不出现停用工具', () => {
    const { container } = renderPage(<HomePage />, 'zh-CN');

    expect(
      screen.getByRole('heading', {
        name: '把日常小工具，放在一个清楚的地方。',
      }),
    ).toBeInTheDocument();

    for (const categoryName of [
      '音频与声音',
      '图像与设计',
      '视频与动效',
      '文档与文字',
      '实用与其他',
    ]) {
      expect(
        screen.getByRole('heading', { name: categoryName }),
      ).toBeInTheDocument();
    }

    for (const toolName of [
      '图片信息检查',
      'Markdown 预览',
      'JSON 查看器',
      '正则表达式工作台',
      '时间戳换算',
      '文本差异比较',
    ]) {
      expect(
        screen.getByRole('heading', { name: toolName }),
      ).toBeInTheDocument();
    }

    expect(screen.getByText('5 个分类')).toBeInTheDocument();
    expect(screen.getByText('6 个启用工具')).toBeInTheDocument();
    expect(container.textContent).not.toContain('CSV 检查器');
  });

  it('分类页只列出该分类下已启用的工具', () => {
    const { container } = renderPage(
      <CategoryPage categoryId="text" />,
      'zh-CN',
    );

    expect(
      screen.getByRole('heading', { name: '文档与文字', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('4 个工具')).toBeInTheDocument();

    for (const toolName of [
      'Markdown 预览',
      'JSON 查看器',
      '正则表达式工作台',
      '文本差异比较',
    ]) {
      expect(
        screen.getByRole('heading', { name: toolName }),
      ).toBeInTheDocument();
    }

    expect(container.textContent).not.toContain('CSV 检查器');
  });

  it('空分类展示本地化空状态', () => {
    renderPage(<CategoryPage categoryId="audio" />, 'zh-CN');

    expect(
      screen.getByRole('heading', { name: '此分类暂时没有工具' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '浏览其他分类' }),
    ).toBeInTheDocument();
  });

  it('工具页使用目录双语数据渲染工作区', () => {
    renderPage(<ToolPage toolId="image-inspector" />, 'zh-CN');

    expect(
      screen.getByRole('heading', { name: '图片信息检查', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('图片信息检查工作区样本').textContent,
    ).toContain('宽度: 1600 px');
    expect(screen.getByText('图片文件名（预览）')).toBeInTheDocument();
  });

  it('停用工具的工具页展示不存在状态', () => {
    renderPage(<ToolPage toolId="csv-inspector" />, 'zh-CN');

    expect(
      screen.getByRole('heading', { name: '工具不存在', level: 1 }),
    ).toBeInTheDocument();
  });

  it('任务页的工具名与分类名来自目录', () => {
    renderPage(<TasksPage />, 'zh-CN');

    expect(
      screen.getByRole('heading', { name: '最近任务样本', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('图片信息检查')).toBeInTheDocument();
    expect(screen.getByText('图像与设计')).toBeInTheDocument();
    expect(screen.getByText('结果样本')).toBeInTheDocument();
  });

  it('管理页列出全部 7 条目录记录，含停用样本', () => {
    renderPage(<AdminPage />, 'zh-CN');

    expect(screen.getAllByRole('switch')).toHaveLength(7);
    expect(screen.getByText('7 项')).toBeInTheDocument();
    expect(screen.getByText('CSV 检查器（停用样本）')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /图片信息检查/ })).toBeChecked();
    expect(
      screen.getByRole('switch', { name: /CSV 检查器/ }),
    ).not.toBeChecked();
  });

  it('404 页展示本地化文案并可返回首页', () => {
    const { navigation } = renderPage(<NotFoundPage />, 'zh-CN');

    expect(
      screen.getByRole('heading', { name: '页面不存在', level: 1 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    expect(navigation.navigate).toHaveBeenCalledWith({ page: 'home' });
  });
});

describe('stage 3 pages · English', () => {
  const pages: readonly { name: string; page: ReactNode; title: string }[] = [
    {
      name: 'home',
      page: <HomePage />,
      title: 'Everyday tools in one clear place.',
    },
    {
      name: 'category',
      page: <CategoryPage categoryId="text" />,
      title: 'Text & documents',
    },
    {
      name: 'tool',
      page: <ToolPage toolId="image-inspector" />,
      title: 'Image inspector',
    },
    {
      name: 'tasks',
      page: <TasksPage />,
      title: 'Recent tasks sample',
    },
    {
      name: 'admin',
      page: <AdminPage />,
      title: 'Admin preview',
    },
    {
      name: 'not-found',
      page: <NotFoundPage />,
      title: 'Page not found',
    },
  ];

  for (const { name, page, title } of pages) {
    it(`${name} 页面为英文且不含中文字符`, () => {
      const { container } = renderPage(page, 'en');

      expect(
        screen.getByRole('heading', { name: title, level: 1 }),
      ).toBeInTheDocument();
      expect(container.textContent ?? '').not.toMatch(CJK_PATTERN);

      cleanup();
    });
  }

  it('工具页的英文工作区使用英文标签与英文样例', () => {
    renderPage(<ToolPage toolId="image-inspector" />, 'en');

    expect(
      screen.getByLabelText('Image inspector workspace sample').textContent,
    ).toContain('Width: 1600 px');
    expect(screen.getByText('Image file name (preview)')).toBeInTheDocument();
  });
});
