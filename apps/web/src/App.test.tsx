import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('stage 2 application preview', () => {
  beforeEach(() => {
    window.innerWidth = 1280;
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the command palette by shortcut and selects a tool with arrow keys and Enter', async () => {
    const user = userEvent.setup();
    render(<App />);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );

    const dialog = await screen.findByRole('dialog', { name: '搜索工具' });
    const searchField = within(dialog).getByRole('combobox', {
      name: '搜索工具',
    });
    await user.click(searchField);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(
      await screen.findByRole('heading', { name: 'Markdown 预览' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/不会提交或执行/)).toBeInTheDocument();
  });

  it('navigates to a category from the desktop rail', async () => {
    const user = userEvent.setup();
    render(<App />);

    const desktopNavigation = screen.getByRole('complementary', {
      name: '桌面分类导航',
    });
    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图像与设计' }),
    );

    expect(
      await screen.findByRole('heading', { name: '图像与设计' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '图片信息检查' }),
    ).toBeInTheDocument();
  });

  it('opens the compact drawer and closes it after choosing a category', async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '打开分类导航' }));
    const drawer = await screen.findByRole('dialog', { name: '工具分类' });
    await user.click(
      within(drawer).getByRole('button', { name: '文档与文字' }),
    );

    expect(
      await screen.findByRole('heading', { name: '文档与文字' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: '工具分类' }),
    ).not.toBeInTheDocument();
  });

  it('opens the recent-task sample panel and navigates to all task samples', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '最近任务' }));
    const recentPanel = await screen.findByRole('dialog', {
      name: '最近任务样本',
    });
    expect(within(recentPanel).getByText(/未连接真实任务/)).toBeInTheDocument();

    await user.click(
      within(recentPanel).getByRole('button', { name: '查看全部样本' }),
    );

    expect(
      await screen.findByRole('heading', { name: '最近任务样本' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '最近任务样本' })).toBeNull();
  });

  it('shows metadata validation feedback and dialog errors without writing data', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '管理预览' }));
    const imageToolSwitch = screen.getByRole('switch', {
      name: '切换图片信息检查样本状态',
    });
    expect(imageToolSwitch).toBeChecked();
    await user.click(imageToolSwitch);
    expect(imageToolSwitch).not.toBeChecked();

    const metadataTitle = within(screen.getByRole('main')).getByRole(
      'textbox',
      { name: '工具名称' },
    );
    await user.clear(metadataTitle);
    await user.click(screen.getByRole('button', { name: '验证表单样本' }));

    expect(
      await screen.findByText('工具名称和简介都需要填写。'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新增工具样本' }));
    const dialog = await screen.findByRole('dialog', { name: '新增工具样本' });
    await user.click(
      within(dialog).getByRole('button', { name: '查看校验反馈' }),
    );
    expect(
      await within(dialog).findByText('请填写工具名称后查看对话框校验反馈。'),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByRole('textbox', { name: '工具名称' }),
      '新的样本工具',
    );
    await user.click(
      within(dialog).getByRole('button', { name: '查看校验反馈' }),
    );

    expect(
      screen.queryByRole('dialog', { name: '新增工具样本' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('新增表单样本校验通过 · 没有创建目录记录。'),
    ).toBeInTheDocument();
  });
});
