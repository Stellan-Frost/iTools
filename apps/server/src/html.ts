import type { SsrRenderResult } from '@itools/contracts';

const HEAD_PLACEHOLDER = '<!--app-head-->';
const APP_PLACEHOLDER = '<!--app-html-->';
const HTML_LANG_ATTRIBUTE = /(<html\b[^>]*?\slang=")([^"]*)(")/i;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 将渲染结果注入 HTML 模板。
 * 占位符缺失时立即抛错，避免静默输出缺少 head 或空页面的响应。
 */
export function injectHtml(template: string, result: SsrRenderResult): string {
  if (!HTML_LANG_ATTRIBUTE.test(template)) {
    throw new Error('HTML template is missing an <html lang="..."> attribute.');
  }
  if (!template.includes(HEAD_PLACEHOLDER)) {
    throw new Error(
      `HTML template is missing the ${HEAD_PLACEHOLDER} placeholder.`,
    );
  }
  if (!template.includes(APP_PLACEHOLDER)) {
    throw new Error(
      `HTML template is missing the ${APP_PLACEHOLDER} placeholder.`,
    );
  }

  const withLang = template.replace(
    HTML_LANG_ATTRIBUTE,
    (_match, start: string, _current: string, end: string) =>
      `${start}${escapeHtml(result.lang)}${end}`,
  );

  // 使用函数/切分替换，避免 appHtml 中的 `$&`、`$1` 等被当作替换模式。
  const withHead = withLang.split(HEAD_PLACEHOLDER).join(result.headHtml);
  return withHead.split(APP_PLACEHOLDER).join(result.appHtml);
}
