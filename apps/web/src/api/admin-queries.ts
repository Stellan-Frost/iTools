/**
 * 管理后台查询选项：只提供键与 queryFn，不调用 `useQuery`。
 * 后台数据随时可能被其他管理员修改，staleTime 固定为 0。
 */
import type { AdminVersion } from '@itools/contracts';

import type {
  AdminApiClient,
  AdminSessionInfo,
  AdminSetupStatus,
} from './admin-types.js';

export const adminSetupStatusQueryKey: readonly ['admin', 'setup-status'] = [
  'admin',
  'setup-status',
];

export const adminSessionQueryKey: readonly ['admin', 'session'] = [
  'admin',
  'session',
];

const ADMIN_STALE_TIME_MS = 0;

export interface AdminSetupStatusQueryOptions {
  queryKey: readonly ['admin', 'setup-status'];
  queryFn: () => Promise<AdminSetupStatus>;
  staleTime: number;
}

export interface AdminSessionQueryOptions {
  queryKey: readonly ['admin', 'session'];
  queryFn: () => Promise<AdminSessionInfo>;
  staleTime: number;
}

export interface AdminVersionsQueryOptions {
  queryKey: readonly ['admin', 'versions', string];
  queryFn: () => Promise<readonly AdminVersion[]>;
  staleTime: number;
}

export function adminSetupStatusQueryOptions(
  client: AdminApiClient,
): AdminSetupStatusQueryOptions {
  return {
    queryKey: adminSetupStatusQueryKey,
    queryFn: () => client.getSetupStatus(),
    staleTime: ADMIN_STALE_TIME_MS,
  };
}

export function adminSessionQueryOptions(
  client: AdminApiClient,
): AdminSessionQueryOptions {
  return {
    queryKey: adminSessionQueryKey,
    queryFn: () => client.getSession(),
    staleTime: ADMIN_STALE_TIME_MS,
  };
}

export function adminVersionsQueryKey(
  toolId: string,
): readonly ['admin', 'versions', string] {
  return ['admin', 'versions', toolId];
}

export function adminVersionsQueryOptions(
  client: AdminApiClient,
  toolId: string,
): AdminVersionsQueryOptions {
  return {
    queryKey: adminVersionsQueryKey(toolId),
    queryFn: () => client.listVersions(toolId),
    staleTime: ADMIN_STALE_TIME_MS,
  };
}
