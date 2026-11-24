import type { Query } from '../strategy';
import { searchTarget } from './bing';
import type { SearchContext, SearchHealth, SearchProvider, SearchRecord } from './types';

type BiliItem = {
  bvid?: string;
  id?: number;
  title?: string;
  description?: string;
  pubdate?: number;
  publish_time?: number;
};

export function parseBilibiliSearch(
  payload: unknown,
  searchType: 'video' | 'article',
  query: Query,
): SearchRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { code?: number; data?: { result?: BiliItem[] } }).data;
  if (!data || !Array.isArray(data.result)) return [];
  const records: SearchRecord[] = [];
  const seen = new Set<string>();
  for (const item of data.result) {
    const title = String(item.title ?? '').replace(/<[^>]+>/g, '');
    const desc = String(item.description ?? '');
    if (!/洛克/i.test(`${title} ${desc}`)) continue;
    const rawUrl =
      searchType === 'video' && item.bvid
        ? `https://www.bilibili.com/video/${item.bvid}`
        : searchType === 'article' && typeof item.id === 'number'
          ? `https://www.bilibili.com/read/cv${item.id}`
          : null;
    if (!rawUrl) continue;
    const url = searchTarget(rawUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const ts = item.pubdate ?? item.publish_time;
    records.push({
      url,
      season: query.season,
      query: query.query,
      published_at:
        typeof ts === 'number' && ts > 0 ? new Date(ts * 1000).toISOString() : undefined,
      provider: `bilibili-${searchType}`,
    });
  }
  return records;
}

function cleanBilibiliKeyword(raw: string): string {
  return raw
    .replace(/\bsite:\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const bilibiliProvider: SearchProvider = {
  id: 'bilibili-native',
  supports(query: Query) {
    return query.platform === 'bilibili';
  },
  async search(query: Query, ctx: SearchContext) {
    const keyword = cleanBilibiliKeyword(query.query);
    if (!keyword) return { records: [], health: [] };
    const records: SearchRecord[] = [];
    const health: SearchHealth[] = [];
    for (const searchType of ['video', 'article'] as const) {
      const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=${searchType}&order=pubdate&keyword=${encodeURIComponent(keyword)}`;
      try {
        const res = await ctx.fetcher(url, 2_000_000, 12000);
        await ctx.save(`search-${ctx.queryIndex}-bili-${searchType}.json`, res.body);
        const parsed: unknown = JSON.parse(res.body.toString('utf8'));
        const code = (parsed as { code?: number }).code;
        if (code !== 0) throw Error(`Bilibili API code ${String(code)}`);
        const found = parseBilibiliSearch(parsed, searchType, query);
        health.push({
          ...query,
          provider: `bilibili-${searchType}`,
          status: found.length ? 'ok' : 'no_supported_results',
          results: found.length,
        });
        records.push(...found);
      } catch (e) {
        health.push({
          ...query,
          provider: `bilibili-${searchType}`,
          status: 'source_fetch_failed',
          results: 0,
          error: String(e),
        });
      }
    }
    return { records, health };
  },
};
