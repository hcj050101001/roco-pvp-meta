export function withBase(path: string, base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
export const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).replaceAll('/', '.') : '日期未标注';
