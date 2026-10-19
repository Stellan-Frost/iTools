import { describe, expect, it } from 'vitest';

import { createCsrfToken, isValidCsrf } from './csrf.js';

describe('createCsrfToken', () => {
  it('生成 16 字节 base64url 且互不重复', () => {
    const tokens = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const token = createCsrfToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      tokens.add(token);
    }

    expect(tokens.size).toBe(100);
  });
});

describe('isValidCsrf', () => {
  it('两侧一致时通过', () => {
    expect(isValidCsrf('abc123', 'abc123')).toBe(true);
  });

  it('任一侧缺失或为空都失败', () => {
    expect(isValidCsrf(undefined, 'abc')).toBe(false);
    expect(isValidCsrf('abc', undefined)).toBe(false);
    expect(isValidCsrf('', '')).toBe(false);
    expect(isValidCsrf(undefined, undefined)).toBe(false);
  });

  it('内容不同或长度不同都失败', () => {
    expect(isValidCsrf('abc123', 'abc124')).toBe(false);
    expect(isValidCsrf('abc', 'abcd')).toBe(false);
  });
});
