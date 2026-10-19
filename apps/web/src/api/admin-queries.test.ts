import type { AdminVersion } from '@itools/contracts';
import { describe, expect, it, vi, type Mock } from 'vitest';

import type { AdminApiClient, AdminSessionInfo } from './admin-types.js';
import {
  adminSessionQueryKey,
  adminSessionQueryOptions,
  adminSetupStatusQueryKey,
  adminSetupStatusQueryOptions,
  adminVersionsQueryKey,
  adminVersionsQueryOptions,
} from './admin-queries.js';

const SESSION: AdminSessionInfo = {
  expiresAt: '2026-10-19T12:00:00.000Z',
  lastSeenAt: '2026-10-19T11:00:00.000Z',
};

const VERSION: AdminVersion = {
  versionId: 7,
  toolId: 'image-resize',
  locale: 'zh-CN',
  name: '图片缩放',
  summary: '调整图片尺寸',
  description: '按像素缩放图片',
  createdAt: '2026-10-19T10:00:00.000Z',
};

function createClientStub(): {
  readonly client: AdminApiClient;
  readonly getSetupStatus: Mock<AdminApiClient['getSetupStatus']>;
  readonly getSession: Mock<AdminApiClient['getSession']>;
  readonly listVersions: Mock<AdminApiClient['listVersions']>;
} {
  const getSetupStatus = vi
    .fn<AdminApiClient['getSetupStatus']>()
    .mockResolvedValue({ available: true });
  const getSession = vi
    .fn<AdminApiClient['getSession']>()
    .mockResolvedValue(SESSION);
  const listVersions = vi
    .fn<AdminApiClient['listVersions']>()
    .mockResolvedValue([VERSION]);

  return {
    client: {
      getSetupStatus,
      setup: vi.fn<AdminApiClient['setup']>(),
      login: vi.fn<AdminApiClient['login']>(),
      logout: vi.fn<AdminApiClient['logout']>(),
      getSession,
      updateMetadata: vi.fn<AdminApiClient['updateMetadata']>(),
      setAvailability: vi.fn<AdminApiClient['setAvailability']>(),
      listVersions,
      rollback: vi.fn<AdminApiClient['rollback']>(),
    },
    getSetupStatus,
    getSession,
    listVersions,
  };
}

describe('adminSetupStatusQueryOptions', () => {
  it('使用稳定键与 0 staleTime，并委托 getSetupStatus', async () => {
    const { client, getSetupStatus } = createClientStub();
    const options = adminSetupStatusQueryOptions(client);

    expect(adminSetupStatusQueryKey).toEqual(['admin', 'setup-status']);
    expect(options.queryKey).toBe(adminSetupStatusQueryKey);
    expect(options.staleTime).toBe(0);

    await expect(options.queryFn()).resolves.toEqual({ available: true });
    expect(getSetupStatus).toHaveBeenCalledTimes(1);
  });
});

describe('adminSessionQueryOptions', () => {
  it('使用稳定键与 0 staleTime，并委托 getSession', async () => {
    const { client, getSession } = createClientStub();
    const options = adminSessionQueryOptions(client);

    expect(adminSessionQueryKey).toEqual(['admin', 'session']);
    expect(options.queryKey).toBe(adminSessionQueryKey);
    expect(options.staleTime).toBe(0);

    await expect(options.queryFn()).resolves.toEqual(SESSION);
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe('adminVersionsQueryOptions', () => {
  it('键包含 toolId 且 staleTime 为 0', () => {
    const { client } = createClientStub();
    const options = adminVersionsQueryOptions(client, 'image-resize');

    expect(adminVersionsQueryKey('image-resize')).toEqual([
      'admin',
      'versions',
      'image-resize',
    ]);
    expect(options.queryKey).toEqual(['admin', 'versions', 'image-resize']);
    expect(options.staleTime).toBe(0);
  });

  it('queryFn 委托 listVersions 并带上同一个 toolId', async () => {
    const { client, listVersions } = createClientStub();
    const options = adminVersionsQueryOptions(client, '音 频 工具');

    await expect(options.queryFn()).resolves.toEqual([VERSION]);
    expect(listVersions).toHaveBeenCalledWith('音 频 工具');
  });

  it('不同 toolId 生成不同查询键', () => {
    expect(adminVersionsQueryKey('a')).not.toEqual(adminVersionsQueryKey('b'));
  });
});
