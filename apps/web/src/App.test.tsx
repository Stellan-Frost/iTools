import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

  it('expands multiple desktop categories without navigating', async () => {
    const user = userEvent.setup();
    render(<App />);

    const desktopNavigation = screen.getByRole('complementary', {
      name: '桌面分类导航',
    });
    const imageCategory = within(desktopNavigation).getByRole('button', {
      name: '图像与设计',
    });
    const documentCategory = within(desktopNavigation).getByRole('button', {
      name: '文档与文字',
    });

    await user.click(imageCategory);
    await user.click(documentCategory);

    expect(imageCategory).toHaveAttribute('aria-expanded', 'true');
    expect(documentCategory).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(desktopNavigation).getByRole('button', { name: '图片信息检查' }),
    ).toBeInTheDocument();
    expect(
      within(desktopNavigation).getByRole('button', { name: 'Markdown 预览' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: '把日常小工具，放在一个清楚的地方。',
      }),
    ).toBeInTheDocument();

    await user.click(imageCategory);
    expect(imageCategory).toHaveAttribute('aria-expanded', 'false');
    expect(documentCategory).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(desktopNavigation).queryByRole('button', {
        name: '图片信息检查',
      }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(imageCategory).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(imageCategory).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens tool information and navigates only from the dialog action', async () => {
    const user = userEvent.setup();
    render(<App />);

    const desktopNavigation = screen.getByRole('complementary', {
      name: '桌面分类导航',
    });
    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图像与设计' }),
    );
    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图片信息检查' }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: '图片信息检查',
    });
    expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveFocus();
    expect(within(dialog).getByText('图像与设计')).toBeInTheDocument();
    expect(
      within(dialog).getByText('图片整理、尺寸检查与视觉素材预览。'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '检查图片文件的基础信息，并预览适合的后续处理方式。',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('图片文件名（预览）')).toBeInTheDocument();
    expect(
      within(dialog).getByText('sample-image.png', { selector: 'code' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('图片工作区样本')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: '图片信息检查' })).toBeNull();
    expect(
      screen.getByRole('heading', {
        name: '把日常小工具，放在一个清楚的地方。',
      }),
    ).toBeInTheDocument();

    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图片信息检查' }),
    );
    const reopenedDialog = await screen.findByRole('dialog', {
      name: '图片信息检查',
    });
    await user.click(
      within(reopenedDialog).getByRole('button', { name: '前往' }),
    );

    expect(
      await screen.findByRole('heading', { name: '图片信息检查' }),
    ).toBeInTheDocument();
  });

  it('closes tool information on Escape and an outside click', async () => {
    const user = userEvent.setup();
    render(<App />);

    const desktopNavigation = screen.getByRole('complementary', {
      name: '桌面分类导航',
    });
    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图像与设计' }),
    );
    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图片信息检查' }),
    );
    await screen.findByRole('dialog', { name: '图片信息检查' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '图片信息检查' })).toBeNull();

    await user.click(
      within(desktopNavigation).getByRole('button', { name: '图片信息检查' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: '图片信息检查',
    });
    const scrim = dialog.parentElement?.firstElementChild;
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim!);
    expect(screen.queryByRole('dialog', { name: '图片信息检查' })).toBeNull();
  });

  it('places the compact expand button at the header end and reuses the accordion in its drawer', async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    render(<App />);

    const expandButton = screen.getByRole('button', { name: '展开' });
    expect(expandButton.parentElement?.lastElementChild).toBe(expandButton);
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(expandButton);
    const drawer = await screen.findByRole('dialog', { name: '工具分类' });

    expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(drawer).getByRole('button', { name: '关闭分类导航' }),
    ).toHaveFocus();
    expect(
      within(drawer).getByRole('button', { name: '图像与设计' }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: '首页' }),
    ).toBeInTheDocument();
    await user.click(
      within(drawer).getByRole('button', { name: '文档与文字' }),
    );

    expect(
      within(drawer).getByRole('button', { name: '文档与文字' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('heading', {
        name: '把日常小工具，放在一个清楚的地方。',
      }),
    ).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole('button', { name: 'Markdown 预览' }),
    );
    const toolDialog = await screen.findByRole('dialog', {
      name: 'Markdown 预览',
    });
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();
    await user.click(within(toolDialog).getByRole('button', { name: '关闭' }));
    expect(
      screen.getByRole('heading', {
        name: '把日常小工具，放在一个清楚的地方。',
      }),
    ).toBeInTheDocument();

    await user.click(expandButton);
    let reopenedDrawer = await screen.findByRole('dialog', {
      name: '工具分类',
    });
    await user.click(
      within(reopenedDrawer).getByRole('button', { name: '关闭分类导航' }),
    );
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();

    await user.click(expandButton);
    await screen.findByRole('dialog', { name: '工具分类' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();

    await user.click(expandButton);
    reopenedDrawer = await screen.findByRole('dialog', { name: '工具分类' });
    const drawerScrim = reopenedDrawer.parentElement?.firstElementChild;
    expect(drawerScrim).not.toBeNull();
    fireEvent.click(drawerScrim!);
    expect(screen.queryByRole('dialog', { name: '工具分类' })).toBeNull();
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
