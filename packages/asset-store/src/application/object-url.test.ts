import { describe, expect, it } from 'vitest';

import { FakeObjectUrlFactory } from '../test-support/fake-object-url.js';

import { createObjectUrlRegistry } from './object-url.js';

function createBlob(text = 'x'): Blob {
  return new Blob([text], { type: 'text/plain' });
}

describe('Object URL 注册表', () => {
  it('首次 acquire 创建一个 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const acquired = registry.acquire(createBlob());

    expect(factory.created).toHaveLength(1);
    expect(acquired.url).toBe(factory.created[0]);
    expect(registry.activeCount).toBe(1);
  });

  it('同一 Blob 重复 acquire 复用同一个 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const blob = createBlob();

    const first = registry.acquire(blob);
    const second = registry.acquire(blob);

    expect(second.url).toBe(first.url);
    expect(factory.created).toHaveLength(1);
    expect(registry.activeCount).toBe(1);
  });

  it('refCount 归零后才撤销 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const blob = createBlob();
    const first = registry.acquire(blob);
    const second = registry.acquire(blob);

    first.release();
    expect(factory.revoked).toHaveLength(0);
    expect(registry.activeCount).toBe(1);

    second.release();
    expect(factory.revoked).toEqual([first.url]);
    expect(registry.activeCount).toBe(0);
  });

  it('重复 release 幂等且不会二次撤销', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const acquired = registry.acquire(createBlob());

    acquired.release();
    acquired.release();
    acquired.release();

    expect(factory.revoked).toHaveLength(1);
    expect(registry.activeCount).toBe(0);
  });

  it('不同 Blob 获得不同 URL，互不影响', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const first = registry.acquire(createBlob('a'));
    const second = registry.acquire(createBlob('b'));

    expect(first.url).not.toBe(second.url);
    expect(registry.activeCount).toBe(2);

    first.release();
    expect(second.url).toBe(factory.created[1] ?? '');
    expect(factory.revoked).toEqual([first.url]);
  });

  it('releaseAll 撤销全部活跃 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    registry.acquire(createBlob('a'));
    registry.acquire(createBlob('b'));

    registry.releaseAll();

    expect(factory.revoked).toHaveLength(2);
    expect(registry.activeCount).toBe(0);
  });

  it('releaseAll 幂等', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    registry.acquire(createBlob());

    registry.releaseAll();
    registry.releaseAll();

    expect(factory.revoked).toHaveLength(1);
  });

  it('releaseAll 后可继续 acquire 并生成新 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const blob = createBlob('a');
    const before = registry.acquire(blob);
    registry.releaseAll();

    const after = registry.acquire(blob);

    expect(after.url).not.toBe(before.url);
    expect(factory.created).toHaveLength(2);
    expect(registry.activeCount).toBe(1);
  });

  it('releaseAll 之后旧句柄释放不会撤销新 URL', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const blob = createBlob();
    const oldHandle = registry.acquire(blob);
    registry.releaseAll();
    const newHandle = registry.acquire(blob);

    oldHandle.release();

    expect(factory.revoked).toEqual([oldHandle.url]);
    expect(factory.active.has(newHandle.url)).toBe(true);
    expect(registry.activeCount).toBe(1);
  });

  it('activeCount 按 Blob 计，不按 acquire 次数计', () => {
    const factory = new FakeObjectUrlFactory();
    const registry = createObjectUrlRegistry(factory);
    const blob = createBlob();

    registry.acquire(blob);
    registry.acquire(blob);
    registry.acquire(blob);

    expect(registry.activeCount).toBe(1);
  });
});
