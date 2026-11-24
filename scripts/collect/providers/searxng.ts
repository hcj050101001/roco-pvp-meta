import { platformFor, type Query } from '../strategy';
import { searchTarget } from './bing';
import type { SearchContext, SearchHealth, SearchProvider, SearchRecord } from './types';

type SearxngResult = {
  url?: string;
  title?: string;
  content?: string;
  publishedDate?: string | null;
};

type SearxngResponse = {
  results?: SearxngResult[];
};

export function parseSearxngResults(payload: unknown, query: Query): SearchRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as SearxngResponse).results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const records: SearchRecord[] = [];
  for (const item of results) {
    if (!item || typeof item.url !== 'string') continue;
    const text = `${item.title ?? ''} ${item.content ?? ''}`;
    if (!/洛克|roco\s*kingdom/i.test(text)) continue;
    const target = searchTarget(item.url);
    if (!target || seen.has(target)) continue;
    if (query.platform !== 'any' && platformFor(target) !== query.platform) continue;
    seen.add(target);
    records.push({
      url: target,
      season: query.season,
      query: query.query,
      published_at:
        typeof item.publishedDate === 'string' && item.publishedDate
          ? item.publishedDate
          : undefined,
      provider: 'searxng',
    });
  }
  return records;
}

export function searxngUrl(): string | null {
  const raw = process.env.SEARXNG_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export const searxngProvider: SearchProvider = {
  id: 'searxng',
  supports() {
    return searxngUrl() !== null;
  },
  async search(query: Query, ctx: SearchContext) {
    const base = searxngUrl();
    if (!base) return { records: [], health: [] };
    const params = new URLSearchParams({
      q: query.query,
      format: 'json',
      language: 'zh-CN',
    });
    if (query.freshness === 'week' || query.freshness === 'month') {
      params.set('time_range', query.freshness);
    }
    const endpoint = `${base}/search?${params.toString()}`;
    const health: SearchHealth[] = [];
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw Error(`SearXNG HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await ctx.save(`search-${ctx.queryIndex}-searxng.json`, buf);
      const parsed: unknown = JSON.parse(buf.toString('utf8'));
      const records = parseSearxngResults(parsed, query);
      health.push({
        ...query,
        provider: 'searxng',
        status: records.length ? 'ok' : 'no_supported_results',
        results: records.length,
      });
      return { records, health };
    } catch (e) {
      health.push({
        ...query,
        provider: 'searxng',
        status: 'source_fetch_failed',
        results: 0,
        error: String(e),
      });
      return { records: [], health };
    }
  },
};
