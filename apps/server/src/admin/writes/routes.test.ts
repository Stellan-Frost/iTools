import { ADMIN_VERSION_RETENTION, AdminErrorCode } from '@itools/contracts';
import type {
  AdminAvailabilityPatch,
  AdminMetadataPatch,
  AdminRollbackRequest,
  AdminVersionRecord,
  CatalogOverride,
  Locale,
  ToolCatalogItem,
} from '@itools/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryAdminVersionRepository } from '../test-support/in-memory-admin-repositories.js';
import { registerAdminWriteRoutes } from './routes.js';
import { FakeCatalogRepository } from './test-support/fake-catalog-repository.js';

const TOOL: ToolCatalogItem = {
  id: 'alpha',
  category: 'image',
  availability: 'implemented',
  name: { 'zh-CN': '阿法', en: 'Alpha' },
  summary: { 'zh-CN': '默认摘要', en: 'Default summary' },
  description: { 'zh-CN': '默认描述', en: 'Default description' },
  order: 10,
  source: 'registry',
};

const NOW = new Date('2026-10-19T00:00:00.000Z');
const BASE = `/api/v1/admin/tools/${TOOL.id}`;
const METADATA_URL = `${BASE}/metadata`;
const AVAILABILITY_URL = `${BASE}/availability`;

interface Harness {
  readonly app: FastifyInstance;
  readonly catalog: FakeCatalogRepository;
  readonly versions: InMemoryAdminVersionRepository;
}

const openApps: FastifyInstance[] = [];

async function createHarness(
  options: { readonly overrides?: readonly CatalogOverride[] } = {},
): Promise<Harness> {
  const catalog = new FakeCatalogRepository(options.overrides ?? []);
  const versions = new InMemoryAdminVersionRepository();
  const app = Fastify({ logger: false });

  registerAdminWriteRoutes(app, {
    catalog,
    versions,
    now: () => NOW,
    readRegistryItem: (toolId) => (toolId === TOOL.id ? TOOL : undefined),
    guard: async () => undefined,
  });
  openApps.push(app);
  return { app, catalog, versions };
}

function patchMetadata(harness: Harness, payload: AdminMetadataPatch) {
  return harness.app.inject({ method: 'PATCH', url: METADATA_URL, payload });
}

function patchAvailability(harness: Harness, payload: AdminAvailabilityPatch) {
  return harness.app.inject({
    method: 'PATCH',
    url: AVAILABILITY_URL,
    payload,
  });
}

function postRollback(harness: Harness, payload: AdminRollbackRequest) {
  return harness.app.inject({
    method: 'POST',
    url: `${BASE}/rollback`,
    payload,
  });
}

async function appendVersion(
  versions: InMemoryAdminVersionRepository,
  locale: Locale,
  name: string,
): Promise<AdminVersionRecord> {
  return versions.append({
    toolId: TOOL.id,
    locale,
    name,
    summary: '摘要',
    description: '描述',
    createdAt: NOW.toISOString(),
  });
}

async function latestOrThrow(
  versions: InMemoryAdminVersionRepository,
  locale: Locale,
): Promise<AdminVersionRecord> {
  const latest = await versions.findLatest(TOOL.id, locale);
  if (latest === undefined) throw new Error(`缺少 ${locale} 版本`);
  return latest;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('PATCH metadata', () => {
  it('逐字段合并：未提交的字段保留已有覆盖', async () => {
    const harness = await createHarness({
      overrides: [
        {
          toolId: TOOL.id,
          displayOrder: 3,
          localizations: [{ locale: 'zh-CN', name: '旧名', summary: '旧摘要' }],
        },
      ],
    });

    const response = await patchMetadata(harness, {
      localizations: { 'zh-CN': { name: '新名' } },
    });

    expect(response.statusCode).toBe(200);
    expect(harness.catalog.lastUpsert()).toEqual({
      toolId: TOOL.id,
      displayOrder: 3,
      availabilityOverride: null,
      localizations: [{ locale: 'zh-CN', name: '新名', summary: '旧摘要' }],
    });
    expect(response.json()).toEqual({
      data: { toolId: TOOL.id, updatedLocales: ['zh-CN'], order: 3 },
    });

    const latest = await latestOrThrow(harness.versions, 'zh-CN');
    expect(latest.name).toBe('新名');
    expect(latest.summary).toBe('旧摘要');
    expect(latest.description).toBe(TOOL.description['zh-CN']);
  });

  it('从未覆盖的字段不会被写成注册表默认值', async () => {
    const harness = await createHarness();

    const response = await patchMetadata(harness, {
      localizations: { 'zh-CN': { name: '新名' } },
    });

    expect(response.statusCode).toBe(200);
    expect(harness.catalog.lastUpsert().localizations).toEqual([
      { locale: 'zh-CN', name: '新名' },
    ]);
    expect(harness.catalog.lastUpsert().displayOrder).toBeNull();
    expect(response.json()).toEqual({
      data: { toolId: TOOL.id, updatedLocales: ['zh-CN'], order: TOOL.order },
    });
  });

  it('修改后追加版本并裁剪到保留上限', async () => {
    const harness = await createHarness();
    for (let index = 0; index < ADMIN_VERSION_RETENTION; index += 1) {
      await appendVersion(harness.versions, 'zh-CN', `版本${index}`);
    }

    const response = await patchMetadata(harness, {
      localizations: { 'zh-CN': { name: '最终名' } },
    });

    expect(response.statusCode).toBe(200);
    const retained = harness.versions.versions.filter(
      (version) => version.locale === 'zh-CN',
    );
    expect(retained).toHaveLength(ADMIN_VERSION_RETENTION);
    expect((await latestOrThrow(harness.versions, 'zh-CN')).name).toBe(
      '最终名',
    );
  });

  it('只改 zh-CN 时不为 en 追加版本', async () => {
    const harness = await createHarness();
    const response = await patchMetadata(harness, {
      localizations: { 'zh-CN': { summary: '新摘要' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { toolId: TOOL.id, updatedLocales: ['zh-CN'], order: TOOL.order },
    });
    expect(await harness.versions.findLatest(TOOL.id, 'en')).toBeUndefined();
    expect(harness.versions.versions).toHaveLength(1);
  });

  it('只更新排序时保留全部文案且不产生版本', async () => {
    const harness = await createHarness({
      overrides: [
        {
          toolId: TOOL.id,
          displayOrder: 3,
          localizations: [{ locale: 'en', name: 'Stored name' }],
        },
      ],
    });

    const response = await patchMetadata(harness, {
      localizations: {},
      order: 7,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { toolId: TOOL.id, updatedLocales: [], order: 7 },
    });
    expect(harness.catalog.lastUpsert()).toEqual({
      toolId: TOOL.id,
      displayOrder: 7,
      availabilityOverride: null,
      localizations: [{ locale: 'en', name: 'Stored name' }],
    });
    expect(harness.versions.versions).toHaveLength(0);
  });
});
describe('PATCH availability', () => {
  it('disabled 写入而 registry 清除覆盖，均保留排序与文案', async () => {
    const harness = await createHarness({
      overrides: [
        {
          toolId: TOOL.id,
          displayOrder: 5,
          localizations: [{ locale: 'zh-CN', summary: '保留摘要' }],
        },
      ],
    });

    const disabled = await patchAvailability(harness, { override: 'disabled' });

    expect(disabled.statusCode).toBe(200);
    expect(disabled.json()).toEqual({
      data: { toolId: TOOL.id, availability: 'disabled' },
    });
    expect(harness.catalog.lastUpsert()).toEqual({
      toolId: TOOL.id,
      displayOrder: 5,
      availabilityOverride: 'disabled',
      localizations: [{ locale: 'zh-CN', summary: '保留摘要' }],
    });

    const fallback = await patchAvailability(harness, { override: 'registry' });

    expect(fallback.statusCode).toBe(200);
    expect(fallback.json()).toEqual({
      data: { toolId: TOOL.id, availability: TOOL.availability },
    });
    expect(harness.catalog.lastUpsert()).toEqual({
      toolId: TOOL.id,
      displayOrder: 5,
      availabilityOverride: null,
      localizations: [{ locale: 'zh-CN', summary: '保留摘要' }],
    });
  });

  it('未知工具返回 404 且不写库', async () => {
    const harness = await createHarness();

    for (const [url, payload] of [
      ['/api/v1/admin/tools/ghost/metadata', { localizations: {} }],
      ['/api/v1/admin/tools/ghost/availability', { override: 'disabled' }],
    ] as const) {
      const response = await harness.app.inject({
        method: 'PATCH',
        url,
        payload,
      });
      expect(response.statusCode).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      const body = response.json<{
        code: string;
        message: string;
        requestId: string;
      }>();
      expect(body.code).toBe('ADMIN_TOOL_NOT_FOUND');
      expect(body.requestId.length).toBeGreaterThan(0);
    }

    expect(harness.catalog.upsertCalls).toHaveLength(0);
  });
});

describe('GET versions', () => {
  it('按 versionId 倒序返回该工具的全部版本', async () => {
    const harness = await createHarness();
    await appendVersion(harness.versions, 'zh-CN', '第一版');
    await appendVersion(harness.versions, 'en', 'Second');
    await appendVersion(harness.versions, 'zh-CN', '第三版');

    const response = await harness.app.inject({
      method: 'GET',
      url: `${BASE}/versions`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<{ data: AdminVersionRecord[] }>();
    expect(body.data.map((v) => v.versionId)).toEqual([3, 2, 1]);
    expect(body.data.map((v) => v.locale)).toEqual(['zh-CN', 'en', 'zh-CN']);
  });
});

describe('POST rollback', () => {
  it('回滚恢复目标文案并追加新版本', async () => {
    const harness = await createHarness({
      overrides: [{ toolId: TOOL.id, displayOrder: 4, localizations: [] }],
    });
    const original = await appendVersion(harness.versions, 'zh-CN', '旧名');

    await patchMetadata(harness, {
      localizations: {
        'zh-CN': { name: '新名', summary: '新摘要', description: '新描述' },
      },
    });
    const updated = await latestOrThrow(harness.versions, 'zh-CN');
    expect(updated.versionId).not.toBe(original.versionId);

    const response = await postRollback(harness, {
      versionId: original.versionId,
      expectedVersionId: updated.versionId,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: { versionId: number; toolId: string; locale: Locale };
    }>();
    expect(body.data.toolId).toBe(TOOL.id);
    expect(body.data.locale).toBe('zh-CN');
    expect(body.data.versionId).toBeGreaterThan(updated.versionId);

    const override = await harness.catalog.getOverride(TOOL.id);
    expect(override?.displayOrder).toBe(4);
    expect(override?.localizations).toEqual([
      { locale: 'zh-CN', name: '旧名', summary: '摘要', description: '描述' },
    ]);

    const appended = await latestOrThrow(harness.versions, 'zh-CN');
    expect(appended.versionId).toBe(body.data.versionId);
    expect(appended.name).toBe('旧名');
    expect(harness.versions.versions).toHaveLength(3);
  });

  it('期间出现新版本时返回 409 且不写任何数据', async () => {
    const harness = await createHarness();
    const original = await appendVersion(harness.versions, 'zh-CN', '旧名');

    await patchMetadata(harness, {
      localizations: { 'zh-CN': { name: '新名' } },
    });
    const upsertsBefore = harness.catalog.upsertCalls.length;
    const versionsBefore = harness.versions.versions.length;

    const response = await postRollback(harness, {
      versionId: original.versionId,
      expectedVersionId: original.versionId,
    });

    expect(response.statusCode).toBe(409);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json<{ code: string }>().code).toBe(
      AdminErrorCode.versionConflict,
    );
    expect(harness.catalog.upsertCalls).toHaveLength(upsertsBefore);
    expect(harness.versions.versions).toHaveLength(versionsBefore);
    expect((await harness.catalog.getOverride(TOOL.id))?.localizations).toEqual(
      [{ locale: 'zh-CN', name: '新名' }],
    );
  });
});

describe('请求体校验', () => {
  it('非法请求体返回 400 invalidRequest 且不写库', async () => {
    const harness = await createHarness();

    const empty = await patchMetadata(harness, {
      localizations: { 'zh-CN': { name: '' } },
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.headers['cache-control']).toBe('no-store');
    expect(empty.json<{ code: string }>().code).toBe(
      AdminErrorCode.invalidRequest,
    );

    const incomplete = await harness.app.inject({
      method: 'POST',
      url: `${BASE}/rollback`,
      payload: { versionId: 1 },
    });
    expect(incomplete.statusCode).toBe(400);
    expect(incomplete.json<{ code: string }>().code).toBe(
      AdminErrorCode.invalidRequest,
    );

    expect(harness.catalog.upsertCalls).toHaveLength(0);
    expect(harness.versions.versions).toHaveLength(0);
  });
});
