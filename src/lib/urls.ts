// withBase 的默认 base 来自 Astro 的 import.meta.env.BASE_URL，即 astro.config.ts 的
// base（源自 src/lib/site.ts 的 basePath）；组件不要在这里硬编码子路径，两者须保持一致。
export function withBase(path: string, base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
export const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).replaceAll('/', '.') : '日期未标注';
