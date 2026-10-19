import { describe, expect, it } from 'vitest';

import { buildClearCookie, buildSetCookie, parseCookies } from './cookies.js';

describe('parseCookies', () => {
  it('缺少请求头时返回空对象', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('解析多个键值并去掉多余空格', () => {
    expect(parseCookies(' itools_admin = abc ; other=1 ')).toEqual({
      itools_admin: 'abc',
      other: '1',
    });
  });

  it('保留第一个重复键', () => {
    expect(parseCookies('a=1; a=2; b=3')).toEqual({ a: '1', b: '3' });
  });

  it('无值的键记为空字符串', () => {
    expect(parseCookies('a; b=; c=3')).toEqual({ a: '', b: '', c: '3' });
  });

  it('忽略空段与空名称', () => {
    expect(parseCookies(';; =x; a=1;')).toEqual({ a: '1' });
  });

  it('值内的等号只切分一次', () => {
    expect(parseCookies('token=abc=def')).toEqual({ token: 'abc=def' });
  });
});

describe('buildSetCookie', () => {
  it('按固定顺序拼接全部属性', () => {
    expect(
      buildSetCookie('itools_admin', 'tok', {
        maxAgeSeconds: 604_800,
        httpOnly: true,
        secure: true,
      }),
    ).toBe(
      'itools_admin=tok; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure',
    );
  });

  it('按需省略 HttpOnly 与 Secure', () => {
    expect(
      buildSetCookie('itools_admin_csrf', 'csrf', {
        maxAgeSeconds: 604_800,
        httpOnly: false,
        secure: false,
      }),
    ).toBe('itools_admin_csrf=csrf; Path=/; Max-Age=604800; SameSite=Strict');
  });

  it('Max-Age 向下取整且不为负', () => {
    expect(
      buildSetCookie('a', 'b', {
        maxAgeSeconds: 12.9,
        httpOnly: false,
        secure: false,
      }),
    ).toContain('Max-Age=12');
    expect(
      buildSetCookie('a', 'b', {
        maxAgeSeconds: -5,
        httpOnly: false,
        secure: false,
      }),
    ).toContain('Max-Age=0');
  });

  it('拼出的 Cookie 能被解析回来', () => {
    const header = buildSetCookie('itools_admin', 'token-value', {
      maxAgeSeconds: 60,
      httpOnly: true,
      secure: false,
    });

    expect(parseCookies(header.split(';')[0])).toEqual({
      itools_admin: 'token-value',
    });
  });
});

describe('buildClearCookie', () => {
  it('使用 Max-Age=0 并保留安全属性', () => {
    expect(
      buildClearCookie('itools_admin', { httpOnly: true, secure: true }),
    ).toBe(
      'itools_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    );
  });

  it('CSRF Cookie 不带 HttpOnly', () => {
    expect(
      buildClearCookie('itools_admin_csrf', {
        httpOnly: false,
        secure: false,
      }),
    ).toBe('itools_admin_csrf=; Path=/; Max-Age=0; SameSite=Strict');
  });
});
