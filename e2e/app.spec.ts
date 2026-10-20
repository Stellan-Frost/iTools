import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const HOME_COPY = {
  'zh-CN': '把日常小工具，放在一个清楚的地方。',
  en: 'Everyday tools in one clear place.',
} as const;

for (const locale of ['zh-CN', 'en'] as const) {
  test(`${locale} home is server rendered and hydrates`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    if (response === null)
      throw new Error('The home navigation had no response.');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(HOME_COPY[locale]);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      HOME_COPY[locale],
    );

    await page
      .getByRole('button', {
        name: locale === 'en' ? 'Switch language' : '切换语言',
      })
      .click();
    const nextLocale = locale === 'en' ? 'zh-CN' : 'en';
    await expect(page).toHaveURL(new RegExp(`/${nextLocale}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', nextLocale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      HOME_COPY[nextLocale],
    );
  });
}

test('search opens after hydration and navigates to a matching preview', async ({
  page,
}) => {
  await page.goto('/zh-CN');
  await page.getByRole('searchbox', { name: '搜索工具' }).first().click();

  const dialog = page.getByRole('dialog', { name: '搜索工具' });
  const search = dialog.getByRole('combobox');
  await search.fill('Markdown');
  await dialog.getByRole('option', { name: /Markdown 预览/ }).click();

  await expect(page).toHaveURL('/zh-CN/text/markdown-preview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Markdown 预览',
  );
});

test('direct preview page stays read only and is excluded from indexing', async ({
  page,
}) => {
  const response = await page.goto('/en/text/markdown-preview');
  if (response === null)
    throw new Error('The preview navigation had no response.');

  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Markdown preview',
  );
  await expect(
    page.getByRole('main').locator('[data-preview-badge="true"]'),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Markdown content (preview)' }),
  ).toBeDisabled();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});

test('task sample opens its associated preview', async ({ page }) => {
  await page.goto('/en/tasks');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Recent tasks sample',
  );
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Open preview' }).first().click();
  await expect(page).toHaveURL('/en/image/image-inspector');
});

test('admin entry fails closed without an isolated database', async ({
  page,
  request,
}) => {
  const response = await page.goto('/zh-CN/admin');
  if (response === null)
    throw new Error('The admin navigation had no response.');

  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('管理后台');
  await expect(page.getByRole('alert')).toHaveText(
    '无法连接管理服务，请稍后重试。',
  );
  await expect(page.getByLabel('管理员口令')).toHaveCount(0);

  const setupStatus = await request.get('/api/v1/admin/setup');
  const session = await request.get('/api/v1/admin/session');
  const protectedWrite = await request.patch(
    '/api/v1/admin/tools/image-inspector/metadata',
    { data: {} },
  );
  expect(setupStatus.status()).toBe(404);
  expect(session.status()).toBe(404);
  expect(protectedWrite.status()).toBe(404);
});

test('unknown, disabled, and mismatched tool routes return real 404 pages', async ({
  page,
}) => {
  for (const route of [
    '/zh-CN/unknown',
    '/zh-CN/text/csv-inspector',
    '/zh-CN/image/markdown-preview',
  ]) {
    const response = await page.goto(route);
    if (response === null) throw new Error(`No response for ${route}.`);
    expect(response.status(), route).toBe(404);
    await expect(
      page.getByRole('heading', { name: '页面不存在' }),
    ).toBeVisible();
  }
});

test('production CSP blocks inline scripts in a real browser', async ({
  page,
}) => {
  const response = await page.goto('/en');
  if (response === null) throw new Error('The CSP navigation had no response.');

  const headers = response.headers();
  const csp = headers['content-security-policy'];
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');

  const inlineScriptExecuted = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent =
      "document.documentElement.dataset.inlineScriptProbe = 'executed'";
    document.head.append(script);
    return document.documentElement.dataset.inlineScriptProbe === 'executed';
  });
  expect(inlineScriptExecuted).toBe(false);
});
