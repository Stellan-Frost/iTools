import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { AppRoute } from './app/route.js';

function renderApp(route: AppRoute = { page: 'home' }, path = '/zh-CN') {
  window.history.replaceState(null, '', path);
  return render(<App initialLocale="zh-CN" initialRoute={route} />);
}

function desktopNavigation() {
  return screen.getByRole('complementary', { name: '桌面分类导航' });
}

describe('stage 3 application shell', () => {
  beforeEach(() => {
    window.innerWidth = 1280;
    document.documentElement.lang = 'zh-CN';
  });

  afterEach(() => {
    cleanup();
  });

  it('expands desktop categories without navigating and lists enabled tools', async () => {
    const user = userEvent.setup();
    renderApp();

    const navigation = desktopNavigation();
    const imageCategory = within(navigation).getByRole('button', {
      name: '图像与设计',
    });
    const textCategory = within(navigation).getByRole('button', {
      name: '文档与文字',
    });

    await user.click(imageCategory);
    await user.click(textCategory);

    expect(imageCategory).toHaveAttribute('aria-expanded', 'true');
    expect(textCategory).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(navigation).getByRole('button', { name: '图片信息检查' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole('button', { name: 'Markdown 预览' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/zh-CN');

    await user.click(imageCategory);

    expect(imageCategory).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(navigation).queryByRole('button', { name: '图片信息检查' }),
    ).not.toBeInTheDocument();
    expect(textCategory).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not list the disabled sample tool in navigation or search', async () => {
    const user = userEvent.setup();
    renderApp();

    const navigation = desktopNavigation();
    await user.click(
      within(navigation).getByRole('button', { name: '文档与文字' }),
    );

    expect(
      within(navigation).queryByRole('button', { name: /CSV 检查器/ }),
    ).not.toBeInTheDocument();

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
    const dialog = await screen.findByRole('dialog', { name: '搜索工具' });
    await user.type(
      within(dialog).getByRole('combobox', { name: '搜索工具' }),
      'CSV',
    );

    expect(
      within(dialog).getByText('没有匹配的工具。试试分类名称或工具名称。'),
    ).toBeInTheDocument();
  });

  it('opens tool information and navigates only from the dialog action', async () => {
    const user = userEvent.setup();
    renderApp();

    const navigation = desktopNavigation();
    await user.click(
      within(navigation).getByRole('button', { name: '图像与设计' }),
    );
    await user.click(
      within(navigation).getByRole('button', { name: '图片信息检查' }),
    );

    const dialog = await screen.findByRole('dialog', { name: '图片信息检查' });
    expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveFocus();
    expect(within(dialog).getByText('图像与设计')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '读取图片的尺寸、格式与文件大小，快速确认素材是否符合使用要求。',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('图片文件名（预览）')).toBeInTheDocument();
    expect(
      within(dialog).getByText('sample-image.png', { selector: 'code' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('图片工作区样本')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: '图片信息检查' })).toBeNull();
    expect(window.location.pathname).toBe('/zh-CN');

    await user.click(
      within(navigation).getByRole('button', { name: '图片信息检查' }),
    );
    const reopenedDialog = await screen.findByRole('dialog', {
      name: '图片信息检查',
    });
    await user.click(
      within(reopenedDialog).getByRole('button', { name: '前往' }),
    );

    expect(window.location.pathname).toBe('/zh-CN/image/image-inspector');
    expect(screen.queryByRole('dialog', { name: '图片信息检查' })).toBeNull();
  });

  it('selects a search result with arrow keys and navigates to its tool path', async () => {
    const user = userEvent.setup();
    renderApp();

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );

    const dialog = await screen.findByRole('dialog', { name: '搜索工具' });
    const searchField = within(dialog).getByRole('combobox', {
      name: '搜索工具',
    });
    expect(within(dialog).getByText('6 项')).toBeInTheDocument();
    await user.click(searchField);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(window.location.pathname).toBe('/zh-CN/text/markdown-preview');
    expect(screen.queryByRole('dialog', { name: '搜索工具' })).toBeNull();
  });

  it('keeps the compact app bar focused on search and exposes actions in the drawer', async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    renderApp();

    const appBar = screen.getByRole('banner');
    const searchField = within(appBar).getByRole('searchbox', {
      name: '搜索工具',
    });
    const navigationButton = within(appBar).getByRole('button', {
      name: '打开导航抽屉和工具分类',
    });

    expect(appBar.children).toHaveLength(2);
    expect(searchField).toHaveAttribute('readonly');
    expect(navigationButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(navigationButton);
    expect(navigationButton).toHaveAttribute('aria-expanded', 'true');

    const drawer = await screen.findByRole('dialog', { name: '工具分类' });
    expect(
      within(drawer).getByRole('button', { name: '关闭分类导航' }),
    ).toHaveFocus();
    expect(within(drawer).getByText('浏览分类')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '图像与设计' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '首页' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '切换深色模式' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '切换语言' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '管理预览' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '最近任务' }),
    ).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole('button', { name: '切换深色模式' }),
    );
    expect(
      within(drawer).getByRole('button', { name: '切换浅色模式' }),
    ).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole('button', { name: '文档与文字' }),
    );
    expect(
      within(drawer).getByRole('button', { name: '文档与文字' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(
      within(drawer).getByRole('button', { name: 'Markdown 预览' }),
    );
    const toolDialog = await screen.findByRole('dialog', {
      name: 'Markdown 预览',
    });
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();
    await user.click(within(toolDialog).getByRole('button', { name: '关闭' }));

    await user.click(navigationButton);
    await screen.findByRole('dialog', { name: '工具分类' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();
  });

  it('opens the recent-task sample panel and navigates to the tasks page', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: '最近任务' }));
    const recentPanel = await screen.findByRole('dialog', {
      name: '最近任务样本',
    });
    expect(within(recentPanel).getByText(/未连接真实任务/)).toBeInTheDocument();

    await user.click(
      within(recentPanel).getByRole('button', { name: '查看全部样本' }),
    );

    expect(window.location.pathname).toBe('/zh-CN/tasks');
    expect(screen.queryByRole('dialog', { name: '最近任务样本' })).toBeNull();
  });

  it('opens the admin preview route', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: '管理预览' }));

    expect(window.location.pathname).toBe('/zh-CN/admin');
  });

  it('switches language on the current tool route and updates the document lang', async () => {
    const user = userEvent.setup();
    renderApp(
      { page: 'tool', toolId: 'image-inspector' },
      '/zh-CN/image/image-inspector',
    );

    await user.click(screen.getByRole('button', { name: '切换语言' }));

    expect(window.location.pathname).toBe('/en/image/image-inspector');
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
    expect(
      screen.getByRole('searchbox', { name: 'Search tools' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', {
        name: 'Desktop category navigation',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch language' }));

    expect(window.location.pathname).toBe('/zh-CN/image/image-inspector');
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('zh-CN');
    });
  });

  it('re-parses the route on browser history navigation', async () => {
    renderApp();

    window.history.pushState(null, '', '/en/tasks');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
    expect(
      screen.getByRole('searchbox', { name: 'Search tools' }),
    ).toBeInTheDocument();
  });
});
