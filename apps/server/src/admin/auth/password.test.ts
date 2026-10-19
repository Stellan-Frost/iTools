import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

const STORED_PATTERN =
  /^scrypt\$N=16384,r=8,p=1\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/;

describe('hashPassword', () => {
  it('产出自描述格式的哈希', async () => {
    const stored = await hashPassword('correct horse battery staple');

    expect(stored).toMatch(STORED_PATTERN);
    const segments = stored.split('$');
    expect(segments).toHaveLength(4);
    expect(Buffer.from(segments[2] ?? '', 'base64')).toHaveLength(16);
    expect(Buffer.from(segments[3] ?? '', 'base64')).toHaveLength(64);
  });

  it('相同口令每次得到不同盐与哈希', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');

    expect(first).not.toBe(second);
    expect(first.split('$')[2]).not.toBe(second.split('$')[2]);
  });
});

describe('verifyPassword', () => {
  it('口令往返校验通过', async () => {
    const stored = await hashPassword('s3cret-passphrase');

    await expect(verifyPassword('s3cret-passphrase', stored)).resolves.toBe(
      true,
    );
  });

  it('错误口令返回 false', async () => {
    const stored = await hashPassword('s3cret-passphrase');

    await expect(verifyPassword('s3cret-passphrasE', stored)).resolves.toBe(
      false,
    );
    await expect(verifyPassword('', stored)).resolves.toBe(false);
  });

  it.each([
    ['空字符串', ''],
    ['无分隔符', 'not-a-hash'],
    ['段数不足', 'scrypt$N=16384,r=8,p=1$c2FsdA=='],
    ['算法不符', 'bcrypt$N=16384,r=8,p=1$c2FsdA==$aGFzaA=='],
    ['参数不符', 'scrypt$N=1024,r=8,p=1$c2FsdA==$aGFzaA=='],
    ['盐长度不符', 'scrypt$N=16384,r=8,p=1$c2FsdA==$aGFzaA=='],
    [
      '非法 base64',
      'scrypt$N=16384,r=8,p=1$!!!!!!!!!!!!!!!!!!!!!!$!!!!!!!!!!!!!!!!!!!!!!',
    ],
    ['哈希长度不符', 'scrypt$N=16384,r=8,p=1$c2FsdHNhbHRzYWx0c2E=$aGFzaA=='],
  ])('格式损坏（%s）返回 false 且不抛错', async (_label, stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });
});
