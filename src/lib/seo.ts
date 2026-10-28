export { absoluteUrl } from './site';
import { absoluteUrl } from './site';
import { withBase } from './urls';

export const SITE_NAME = '洛克配队手册';
export const SITE_DESCRIPTION =
  '洛克王国：世界 PVP 配队手册。浏览真实阵容配置、作者攻略与对应视频，回顾往期配队。';

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: absoluteUrl(withBase(path)),
    })),
  };
}

/** 转义 `<` 与 `&`，避免 JSON-LD 内容提前闭合 script 标签。 */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('&', '\\u0026');
}
