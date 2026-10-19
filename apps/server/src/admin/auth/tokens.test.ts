import { describe, expect, it } from 'vitest';

import {
  createSessionToken,
  hashToken,
  timingSafeEqualString,
} from './tokens.js';

describe('createSessionToken', () => {
  it('生成 32 字节 base64url 且互不重复', () => {
    const tokens = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      const token = createSessionToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      tokens.add(token);
    }

    expect(tokens.size).toBe(200);
  });
});

describe('hashToken', () => {
  it('稳定输出 64 位十六进制', () => {
    const token = 'fixed-token-value';
    const digest = hashToken(token);

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(digest);
    expect(hashToken(`${token}x`)).not.toBe(digest);
  });
});

describe('timingSafeEqualString', () => {
  it('相同内容返回 true', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('', '')).toBe(true);
  });

  it('等长不同内容返回 false', () => {
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
  });

  it('长度不同返回 false', () => {
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualString('', 'a')).toBe(false);
  });

  it('多字节字符按字节比较', () => {
    expect(timingSafeEqualString('口令', '口令')).toBe(true);
    expect(timingSafeEqualString('口令', '口另')).toBe(false);
  });
});
