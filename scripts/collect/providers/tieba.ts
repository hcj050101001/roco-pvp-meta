import * as cheerio from 'cheerio';
import type { Query } from '../strategy';
import { searchTarget } from './bing';
import type { SearchContext, SearchHealth, SearchProvider, SearchRecord } from './types';

export function parseTiebaSearch(html: string, query: Query): SearchRecord[] {
  const $ = cheerio.load(html);
  const records: SearchRecord[] = [];
  const seen = new Set<string>();
  $('.s_post, .j_thread_list').each((_, el) => {
    const node = $(el);
    const text = node.text();
    if (!/洛克|配队|阵容|一图流/i.test(text)) return;
    const href = node.find('a[href*="/p/"]').first().attr('href');
    if (!href) return;
    const raw = href.startsWith('http') ? href : `https://tieba.baidu.com${href}`;
    const target = searchTarget(raw.split('?')[0]);
    if (!target || seen.has(target)) return;
    seen.add(target);
    records.push({
      url: target,
      season: query.season,
      query: query.query,
      provider: 'tieba-native',
    });
  });
  return records;
}

export const tiebaProvider: SearchProvider = {
  id: 'tieba-native',
  supports(query: Query) {
    return query.platform === 'tieba';
  },
  async search(query: Query, ctx: SearchContext) {
    const kw = query.query
      .replace(/\bsite:\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const url = `https://tieba.baidu.com/f/search/res?ie=utf-8&qw=${encodeURIComponent(kw)}`;
    const health: SearchHealth[] = [];
    try {
      const r = await ctx.fetcher(url, 2_000_000, 12000);
      await ctx.save(`search-${ctx.queryIndex}-tieba.html`, r.body);
      const html = r.body.toString('utf8');
      if (/百度安全验证|验证码/i.test(html)) throw Error('贴吧搜索访问受限');
      const records = parseTiebaSearch(html, query);
      health.push({
        ...query,
        provider: 'tieba-native',
        status: records.length ? 'ok' : 'no_supported_results',
        results: records.length,
      });
      return { records, health };
    } catch (e) {
      health.push({
        ...query,
        provider: 'tieba-native',
        status: 'source_fetch_failed',
        results: 0,
        error: String(e),
      });
      return { records: [], health };
    }
  },
};
