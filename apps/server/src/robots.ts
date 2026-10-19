import { LOCALES } from '@itools/contracts';

/** tasks 与 admin 页面不参与索引（D13）。 */
export const DISALLOWED_PATHS: readonly string[] = (
  ['tasks', 'admin'] as const
).flatMap((page) => LOCALES.map((locale) => `/${locale}/${page}`));

export function buildRobotsTxt(siteOrigin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    `Sitemap: ${siteOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}
