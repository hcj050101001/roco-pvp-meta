import * as cheerio from 'cheerio';
import { seasonNumber } from './rank';
export interface SeasonEvidence {
  id: string;
  name: string;
  started_at: string;
  source_url: string;
  theme: string;
}
// 固定浅色是产品规则，不随赛季换色：主题恒为 'light'，不再经由 themeFor 这类
// 看似可配置的函数中转，避免后来人误以为主题可随赛季名变化。
interface SeasonArticle {
  '@type'?: unknown;
  author?: { url?: unknown };
  headline?: unknown;
  description?: unknown;
  datePublished?: unknown;
}
export function officialSeason(
  html: string,
  sourceUrl: string,
  now = new Date(),
): SeasonEvidence | null {
  const u = new URL(sourceUrl);
  if (u.hostname !== 'www.taptap.cn' || !u.pathname.startsWith('/moment/')) return null;
  const doc = cheerio.load(html);
  for (const el of doc('script[type="application/ld+json"]').toArray()) {
    let article: SeasonArticle;
    try {
      article = JSON.parse(doc(el).text()) as SeasonArticle;
    } catch {
      continue;
    }
    if (
      article['@type'] !== 'NewsArticle' ||
      article.author?.url !== 'https://www.taptap.cn/user/99962293'
    )
      continue;
    const title = String(article.headline || ''),
      description = String(article.description || '');
    const match = title.match(/S(\d+)赛季[「《“\s]*([^」》”\s]+?)[」》”]/i);
    if (!match || /前瞻|预告|将于|即将/.test(title)) continue;
    if (!/版本更新已全部完成|正式上线|正式启幕|现已开启|正式启程/.test(description)) continue;
    if (typeof article.datePublished !== 'string') continue;
    const launched = new Date(article.datePublished);
    if (!Number.isFinite(launched.getTime()) || launched > now) continue;
    return {
      id: `S${Number(match[1])}`,
      name: match[2],
      started_at: launched.toISOString(),
      source_url: u.href,
      theme: 'light',
    };
  }
  return null;
}
export function latestLaunched(evidence: SeasonEvidence[], current: string) {
  return (
    evidence
      .filter((s) => seasonNumber(s.id) >= seasonNumber(current))
      .sort((a, b) => seasonNumber(b.id) - seasonNumber(a.id))[0] || null
  );
}
