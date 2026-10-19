import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '@itools/app-core';
import type { AdminVersion, ToolCatalogItem } from '@itools/contracts';
import {
  AppThemeProvider,
  SnackbarProvider,
} from '@itools/design-system-adapter';
import {
  AppNavigationProvider,
  type AppNavigation,
} from '../../app/navigation.js';
import { AdminApiError } from '../../api/admin-types.js';
import type {
  AdminApiClient,
  AdminSessionInfo,
} from '../../api/admin-types.js';
import type { ToolApiClient } from '../../api/client.js';
import { AdminPage } from './AdminPage.js';

const SESSION: AdminSessionInfo = {
  expiresAt: '2026-10-19T12:00:00.000Z',
  lastSeenAt: '2026-10-19T10:00:00.000Z',
};

const TOOLS: readonly ToolCatalogItem[] = [
  {
    id: 'image-inspector',
    category: 'image',
    availability: 'preview',
    name: { 'zh-CN': '图片信息检查', en: 'Image inspector' },
    summary: { 'zh-CN': '查看图片信息。', en: 'Inspect image metadata.' },
    description: {
      'zh-CN': '查看图片的尺寸与格式。',
      en: 'Inspect image size and format.',
    },
    order: 10,
    source: 'registry',
  },
];

const VERSIONS: readonly AdminVersion[] = [
  {
    versionId: 1,
    toolId: 'image-inspector',
    locale: 'zh-CN',
    name: '旧版本',
    summary: '旧简介',
    description: '旧描述',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    versionId: 3,
    toolId: 'image-inspector',
    locale: 'zh-CN',
    name: '新版本',
    summary: '新简介',
    description: '新描述',
    createdAt: '2026-10-10T08:00:00.000Z',
  },
  {
    versionId: 2,
    toolId: 'image-inspector',
    locale: 'en',
    name: 'English version',
    summary: 'English summary',
    description: 'English description',
    createdAt: '2026-10-05T08:00:00.000Z',
  },
];

function createCatalogClient(
  tools: readonly ToolCatalogItem[] = TOOLS,
): ToolApiClient {
  return {
    listTools: vi.fn(async () => tools),
    getTool: vi.fn(async (toolId: string) => {
      const found = tools.find((tool) => tool.id === toolId);
      if (found === undefined) {
        throw new Error('missing tool');
      }
      return found;
    }),
    healthReady: vi.fn(async () => ({
      status: 'ok' as const,
      checks: { database: 'ok' as const },
    })),
  };
}

function createAdminClient(
  overrides: Partial<AdminApiClient> = {},
): AdminApiClient {
  return {
    getSetupStatus: vi.fn(async () => ({ available: false })),
    setup: vi.fn(async () => SESSION),
    login: vi.fn(async () => SESSION),
    logout: vi.fn(async () => undefined),
    getSession: vi.fn(async () => {
      throw new AdminApiError('ADMIN_NOT_AUTHENTICATED', 401);
    }),
    updateMetadata: vi.fn(async (toolId: string) => ({
      toolId,
      updatedLocales: [],
      order: 10,
    })),
    setAvailability: vi.fn(async (toolId: string) => ({
      toolId,
      availability: 'disabled',
    })),
    listVersions: vi.fn(async () => []),
    rollback: vi.fn(async (toolId: string) => ({
      versionId: 1,
      toolId,
      locale: 'zh-CN' as const,
    })),
    ...overrides,
  };
}

function renderAdmin(
  adminClient: AdminApiClient,
  catalogClient: ToolApiClient = createCatalogClient(),
) {
  const navigation: AppNavigation = {
    locale: 'zh-CN',
    route: { page: 'admin' },
    navigate: vi.fn(),
    switchLocale: vi.fn(),
    openSearch: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={createI18n('zh-CN')}>
      <AppThemeProvider mode="light">
        <SnackbarProvider>
          <AppNavigationProvider value={navigation}>
            <AdminPage
              adminClient={adminClient}
              catalogClient={catalogClient}
            />
          </AppNavigationProvider>
        </SnackbarProvider>
      </AppThemeProvider>
    </I18nextProvider>,
  );
}

function rollbackButtonFor(versionName: string): HTMLElement {
  const row = screen.getByText(versionName).closest('li');
  if (row === null) {
    throw new Error(`missing version row: ${versionName}`);
  }
  return within(row).getByRole('button', { name: '回滚' });
}

async function openTool() {
  fireEvent.click(await screen.findByRole('button', { name: /图片信息检查/ }));
  await screen.findByLabelText('简体中文名称');
}

afterEach(() => {
  cleanup();
});

describe('admin · 初始化', () => {
  it('可用时展示初始化表单', async () => {
    const adminClient = createAdminClient({
      getSetupStatus: vi.fn(async () => ({ available: true })),
    });
    renderAdmin(adminClient);

    expect(await screen.findByLabelText('初始化令牌')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '初始化管理员口令' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('确认口令')).toBeInTheDocument();
  });

  it('口令不足 12 位时就地报错且不调用 setup', async () => {
    const setup = vi.fn(async () => SESSION);
    const adminClient = createAdminClient({
      getSetupStatus: vi.fn(async () => ({ available: true })),
      setup,
    });
    renderAdmin(adminClient);

    fireEvent.change(await screen.findByLabelText('初始化令牌'), {
      target: { value: 'setup-token' },
    });
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByLabelText('确认口令'), {
      target: { value: '12345678901' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成初始化' }));

    expect(await screen.findByText('口令至少需要 12 位。')).toBeInTheDocument();
    expect(setup).not.toHaveBeenCalled();
  });

  it('初始化成功后进入已登录并展示工具列表', async () => {
    const setup = vi.fn(async () => SESSION);
    const adminClient = createAdminClient({
      getSetupStatus: vi.fn(async () => ({ available: true })),
      setup,
    });
    renderAdmin(adminClient);

    fireEvent.change(await screen.findByLabelText('初始化令牌'), {
      target: { value: 'setup-token' },
    });
    fireEvent.change(screen.getByLabelText('管理员口令'), {
      target: { value: 'a-long-password' },
    });
    fireEvent.change(screen.getByLabelText('确认口令'), {
      target: { value: 'a-long-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成初始化' }));

    expect(
      await screen.findByRole('button', { name: /图片信息检查/ }),
    ).toBeInTheDocument();
    expect(setup).toHaveBeenCalledWith({
      token: 'setup-token',
      password: 'a-long-password',
    });
    expect(screen.getByText('1 个工具')).toBeInTheDocument();
  });
});

describe('admin · 登录', () => {
  it('未认证且不可初始化时展示登录表单，失败显示口令错误', async () => {
    const login = vi.fn(async () => {
      throw new AdminApiError('ADMIN_INVALID_CREDENTIALS', 401);
    });
    const adminClient = createAdminClient({ login });
    renderAdmin(adminClient);

    const password = await screen.findByLabelText('管理员口令');
    fireEvent.change(password, { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('口令错误。')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('wrong-password');
  });

  it('写入返回 401 时回到登录状态并提示会话过期', async () => {
    const adminClient = createAdminClient({
      getSession: vi.fn(async () => SESSION),
      updateMetadata: vi.fn(async () => {
        throw new AdminApiError('ADMIN_NOT_AUTHENTICATED', 401);
      }),
    });
    renderAdmin(adminClient);

    await openTool();
    fireEvent.change(screen.getByLabelText('简体中文名称'), {
      target: { value: '新的名称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(
      await screen.findByRole('heading', { name: '输入管理员口令' }),
    ).toBeInTheDocument();
    expect(screen.getByText('会话已过期，请重新登录。')).toBeInTheDocument();
  });
});

describe('admin · 元数据', () => {
  it('只提交被修改的字段', async () => {
    const updateMetadata = vi.fn(async (toolId: string) => ({
      toolId,
      updatedLocales: ['zh-CN'],
      order: 10,
    }));
    const adminClient = createAdminClient({
      getSession: vi.fn(async () => SESSION),
      updateMetadata,
    });
    renderAdmin(adminClient);

    await openTool();
    fireEvent.change(screen.getByLabelText('简体中文名称'), {
      target: { value: '新的名称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateMetadata).toHaveBeenCalledTimes(1);
    });
    expect(updateMetadata).toHaveBeenCalledWith('image-inspector', {
      localizations: { 'zh-CN': { name: '新的名称' } },
    });
  });
});

describe('admin · 上下架', () => {
  it('下架需要确认，确认后调用 setAvailability', async () => {
    const setAvailability = vi.fn(async (toolId: string) => ({
      toolId,
      availability: 'disabled',
    }));
    const adminClient = createAdminClient({
      getSession: vi.fn(async () => SESSION),
      setAvailability,
    });
    renderAdmin(adminClient);

    await openTool();
    fireEvent.click(screen.getByRole('button', { name: '下架' }));

    expect(await screen.findByText('确认下架该工具？')).toBeInTheDocument();
    expect(setAvailability).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认下架' }));
    await waitFor(() => {
      expect(setAvailability).toHaveBeenCalledWith(
        'image-inspector',
        'disabled',
      );
    });
  });
});

describe('admin · 版本历史', () => {
  it('渲染版本列表，回滚带上最新的 expectedVersionId', async () => {
    const rollback = vi.fn(async (toolId: string) => ({
      versionId: 1,
      toolId,
      locale: 'zh-CN' as const,
    }));
    const adminClient = createAdminClient({
      getSession: vi.fn(async () => SESSION),
      listVersions: vi.fn(async () => VERSIONS),
      rollback,
    });
    renderAdmin(adminClient);

    await openTool();
    expect(await screen.findByText('旧版本')).toBeInTheDocument();
    expect(screen.getByText('新版本')).toBeInTheDocument();
    expect(screen.getByText('English version')).toBeInTheDocument();

    fireEvent.click(rollbackButtonFor('旧版本'));
    fireEvent.click(await screen.findByRole('button', { name: '确认回滚' }));

    await waitFor(() => {
      expect(rollback).toHaveBeenCalledWith('image-inspector', {
        versionId: 1,
        expectedVersionId: 3,
      });
    });
  });

  it('版本冲突时显示提示并刷新列表', async () => {
    const listVersions = vi.fn(async () => VERSIONS);
    const rollback = vi.fn(async () => {
      throw new AdminApiError('ADMIN_VERSION_CONFLICT', 409);
    });
    const adminClient = createAdminClient({
      getSession: vi.fn(async () => SESSION),
      listVersions,
      rollback,
    });
    renderAdmin(adminClient);

    await openTool();
    fireEvent.click(rollbackButtonFor('旧版本'));
    fireEvent.click(await screen.findByRole('button', { name: '确认回滚' }));

    expect(
      await screen.findByText(
        '该语言已有更新的版本，版本列表已刷新，请重新确认。',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(listVersions).toHaveBeenCalledTimes(2);
    });
  });
});
