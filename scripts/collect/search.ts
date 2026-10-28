import * as cheerio from 'cheerio';
import { publicFetch } from './network';
import { platformFor, type Query } from './strategy';

export const allowedSource = (raw: string) => platformFor(raw) !== null;
export function searchTarget(raw: string): string | null {
  try {
    let u = new URL(raw, 'https://www.bing.com');
    if (['www.bing.com', 'cn.bing.com'].includes(u.hostname) && u.pathname === '/ck/a') {
      const encoded = u.searchParams.get('u');
      if (!encoded?.startsWith('a1')) return null;
      u = new URL(Buffer.from(encoded.slice(2), 'base64url').toString('utf8'));
    }
    if (u.protocol === 'http:') u.protocol = 'https:';
    u.hash = '';
    return allowedSource(u.href) ? u.href : null;
  } catch {
    return null;
  }
}
export function ingestSearch(html: string, requireGameContext = false) {
  const xml = html.trimStart().startsWith('<?xml') || html.includes('<rss');
  const $ = cheerio.load(html, { xml });
  const urls: string[] = [];
  const add = (raw: string) => {
    const url = searchTarget(raw);
    if (url) urls.push(url);
  };
  const relevant = (text: string) => !requireGameContext || /洛克|roco\s*kingdom/i.test(text);
  $('item').each((_, e) => {
    if (relevant($(e).text())) add($(e).find('link').text().trim());
  });
  $(xml ? 'a[href]' : '.b_algo h2 a[href]').each((_, e) => {
    if (relevant(xml ? $(e).text() : $(e).closest('.b_algo').text())) add($(e).attr('href')!);
  });
  return [...new Set(urls)];
}
export async function discover(
  queries: Query[],
  save: (name: string, body: Buffer) => Promise<void>,
  fetcher = publicFetch,
) {
  const records: { url: string; season: string; query: string }[] = [];
  const health: {
    query: string;
    season: string;
    platform: string;
    provider: string;
    status: string;
    results: number;
    error?: string;
  }[] = [];
  for (let start = 0; start < queries.length; start += 3) {
    await Promise.all(
      queries.slice(start, start + 3).map(async (query, offset) => {
        const i = start + offset;
        for (const provider of ['bing-rss', 'bing-html']) {
          const url = `https://www.bing.com/search?${provider === 'bing-rss' ? 'format=rss&' : ''}q=${encodeURIComponent(query.query)}`;
          try {
            const r = await fetcher(url, 2_000_000, 12000);
            await save(
              `search-${i}-${provider}.${provider === 'bing-rss' ? 'xml' : 'html'}`,
              r.body,
            );
            const html = r.body.toString('utf8');
            if (/访问验证|安全验证|验证码|<title[^>]*>[^<]*(?:captcha|access denied)/i.test(html))
              throw Error('搜索访问受限');
            const found = ingestSearch(html, true).filter(
              (url) => query.platform === 'any' || platformFor(url) === query.platform,
            );
            health.push({
              ...query,
              provider,
              status: found.length ? 'ok' : 'no_supported_results',
              results: found.length,
            });
            records.push(
              ...found.map((url) => ({ url, season: query.season, query: query.query })),
            );
            if (found.length) break;
          } catch (e) {
            health.push({
              ...query,
              provider,
              status: 'source_fetch_failed',
              results: 0,
              error: String(e),
            });
          }
        }
      }),
    );
  }
  return { urls: [...new Set(records.map((r) => r.url))], records, health };
}
