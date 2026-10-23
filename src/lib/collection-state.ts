export interface CollectionState { query: string; type: string; season: string; video: boolean; sort: string }
export function readCollectionState(url: URL, types: string[], seasons: string[]): CollectionState {
  const p = url.searchParams;
  const type = p.get('type') ?? 'all', season = p.get('season') ?? 'all', sort = p.get('sort') ?? 'recommended';
  return { query: p.get('q') ?? '', type: types.includes(type) ? type : 'all', season: seasons.includes(season) ? season : 'all',
    video: p.get('video') === '1', sort: ['recommended', 'recent', 'name'].includes(sort) ? sort : 'recommended' };
}
export function writeCollectionState(url: URL, state: CollectionState) {
  const result = new URL(url);
  const values = { q: state.query.trim(), type: state.type === 'all' ? '' : state.type, season: state.season === 'all' ? '' : state.season,
    video: state.video ? '1' : '', sort: state.sort === 'recommended' ? '' : state.sort };
  for (const [key, value] of Object.entries(values)) { if (value) result.searchParams.set(key, value); else result.searchParams.delete(key); }
  return result;
}
export function safeCollectionReturn(value: string | null, origin: string, base: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, origin), root = `${base.replace(/\/$/, '')}/`;
    if (url.origin !== origin || url.username || url.password || ![root, `${root}history/`].includes(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}
