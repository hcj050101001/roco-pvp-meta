import * as cheerio from 'cheerio';
import { platformFor, type Query } from '../strategy';
import { searchTarget } from './bing';
import type { SearchContext, SearchHealth, SearchProvider, SearchRecord } from './types';

export function parseSo360Results(html: string, query: Query): SearchRecord[] {
  const $ = cheerio.load(html);
  const records: SearchRecord[] = [];
  const seen = new Set<string>();
  $('li.res-list, .res-list').each((_, el) => {
    const node = $(el);
    const text = node.text();
    if (!/洛克|roco\s*kingdom/i.test(text)) return;
    const link = node.find('h3 a[href], a[data-mdurl]').first();
    const raw = link.attr('data-mdurl') || link.attr('href');
    if (!raw) return;
    const target = searchTarget(raw);
    if (!target || seen.has(target)) return;
    if (query.platform !== 'any' && platformFor(target) !== query.platform) return;
    seen.add(target);
    records.push({
      url: target,
      season: query.season,
      query: query.query,
      provider: 'so360',
    });
  });
  return records;
}

export const so360Provider: SearchProvider = {
  id: 'so360',
  supports() {
    return true;
  },
  async search(query: Query, ctx: SearchContext) {
    const url = `https://www.so.com/s?q=${encodeURIComponent(query.query)}`;
    const health: SearchHealth[] = [];
    try {
      const r = await ctx.fetcher(url, 2_000_000, 12000);
      await ctx.save(`search-${ctx.queryIndex}-so360.html`, r.body);
      const html = r.body.toString('utf8');
      if (/访问验证|安全验证|验证码|antispider/i.test(html)) throw Error('360 搜索访问受限');
      const records = parseSo360Results(html, query);
      health.push({
        ...query,
        provider: 'so360',
        status: records.length ? 'ok' : 'no_supported_results',
        results: records.length,
      });
      return { records, health };
    } catch (e) {
      health.push({
        ...query,
        provider: 'so360',
        status: 'source_fetch_failed',
        results: 0,
        error: String(e),
      });
      return { records: [], health };
    }
  },
};
