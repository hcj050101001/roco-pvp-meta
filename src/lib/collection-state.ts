export interface CollectionState {
  query: string;
  type: string;
  season: string;
  video: boolean;
  sort: string;
  page: number;
}
/** 页码钳制：非整数、小于 1 回落到 1；超出总页数时钳制到总页数（总页数未知时不钳制上界）。 */
export function clampPage(page: number, totalPages?: number): number {
  const value = Math.floor(page) || 1;
  if (value < 1) return 1;
  return totalPages === undefined ? value : Math.min(value, Math.max(1, totalPages));
}
export function readCollectionState(
  url: URL,
  types: string[],
  seasons: string[],
  totalPages?: number,
): CollectionState {
  const p = url.searchParams;
  const type = p.get('type') ?? 'all',
    season = p.get('season') ?? 'all',
    sort = p.get('sort') ?? 'recommended';
  const rawPage = p.get('page');
  const page = rawPage === null ? 1 : clampPage(Number(rawPage), totalPages);
  return {
    query: p.get('q') ?? '',
    type: types.includes(type) ? type : 'all',
    season: seasons.includes(season) ? season : 'all',
    video: p.get('video') === '1',
    sort: ['recommended', 'recent'].includes(sort) ? sort : 'recommended',
    page,
  };
}
export function writeCollectionState(url: URL, state: CollectionState) {
  const result = new URL(url);
  const values = {
    q: state.query.trim(),
    type: state.type === 'all' ? '' : state.type,
    season: state.season === 'all' ? '' : state.season,
    video: state.video ? '1' : '',
    sort: state.sort === 'recent' ? state.sort : '',
    page: state.page > 1 ? String(state.page) : '',
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) result.searchParams.set(key, value);
    else result.searchParams.delete(key);
  }
  return result;
}
export function safeCollectionReturn(value: string | null, origin: string, base: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, origin),
      root = `${base.replace(/\/$/, '')}/`;
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (![root, `${root}history/`].includes(url.pathname) &&
        !new RegExp(
          `^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:history/)?page/(?:[2-9]|[1-9][0-9]+)/$`,
        ).test(url.pathname))
    )
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
