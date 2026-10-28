export { absoluteUrl } from './site';

export const SITE_NAME = '洛克配队手册';
export const SITE_DESCRIPTION =
  '洛克王国：世界 PVP 配队手册。浏览真实阵容配置、作者攻略与对应视频，回顾往期配队。';

/** 转义 `<` 与 `&`，避免 JSON-LD 内容提前闭合 script 标签。 */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('&', '\\u0026');
}
