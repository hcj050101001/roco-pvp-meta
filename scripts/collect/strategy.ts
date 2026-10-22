import { createHash } from 'node:crypto';
import policy from '../../data/research-policy.json';

export type Scope = 'all' | 'current' | 'history';
export type Query = { query: string; season: string; platform: string };
export type Source = { id: string; url: string; platform: string; enabled: boolean; seasons: string[]; origin: string; pending_image_urls?: string[] };

export function platformFor(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    return policy.platforms.find(p => u.hostname === p.domain || u.hostname.endsWith('.' + p.domain))?.id ?? null;
  } catch { return null; }
}

export function selectedSeasons(current: string, known: string[], scope: string): string[] {
  if (!['all', 'current', 'history'].includes(scope)) throw Error('scope 必须为 all、current 或 history');
  const history = [...new Set(known)].filter(s => s !== current).reverse();
  return scope === 'current' ? [current] : scope === 'history' ? history : [current, ...history];
}

// Only explicit placeholders expand: literal S2/S3 queries must never become S4.
export function queryPlan(templates: string[], seasons: string[]): Query[] {
  const result: Query[] = [];
  for (const season of seasons) for (const p of policy.platforms)
    result.push({ query: `site:${p.domain} 洛克王国世界 ${season} PVP 配队 一图流`, season, platform: p.id });
  for (const template of templates) {
    const literalSeason = template.match(/\bS\d+\b/i)?.[0].toUpperCase();
    if (!template.includes('{season}') && literalSeason && !seasons.includes(literalSeason)) continue;
    for (const season of template.includes('{season}') ? seasons : [literalSeason ?? 'unspecified'])
      result.push({ query: template.replaceAll('{season}', season), season, platform: 'any' });
  }
  return result.filter((q, i, all) => all.findIndex(x => x.query === q.query) === i);
}

export function sourceFor(raw: string, seasons: string[], origin: string): Source | null {
  const platform = platformFor(raw);
  if (!platform) return null;
  const u = new URL(raw); u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|spm$|from$)/i.test(key)) u.searchParams.delete(key);
  const url = u.href;
  return { id: `source-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`, url, platform, enabled: true, seasons, origin };
}

export function mergeSources(items: Source[]): Source[] {
  const result = new Map<string, Source>();
  for (const item of items) {
    const old = result.get(item.url);
    if (old) {
      old.seasons = [...new Set([...old.seasons, ...item.seasons])];
      if (item.pending_image_urls) old.pending_image_urls = [...new Set([...(old.pending_image_urls ?? []), ...item.pending_image_urls])];
    }
    else result.set(item.url, { ...item, seasons: [...item.seasons] });
  }
  return [...result.values()];
}

// One mirror cannot consume the budget before other platforms and seasons.
export function balancedSources(items: Source[], seasons: string[], limit: number) {
  const unique = mergeSources(items), selected: Source[] = [], used = new Set<string>();
  const cells = policy.platforms.flatMap(p => seasons.map(season => unique.filter(s => s.platform === p.id && s.seasons.includes(season))));
  while (selected.length < limit) {
    let added = false;
    for (const cell of cells) {
      const item = cell.find(s => !used.has(s.url));
      if (item && selected.length < limit) { selected.push(item); used.add(item.url); added = true; }
    }
    if (!added) break;
  }
  return { selected, deferred: unique.filter(s => !used.has(s.url)) };
}

// Platform-neutral discovery: dimensions and semantic evidence are checked later.
export function candidateImage(image: { url: string; context: string }): boolean {
  try {
    const u = new URL(image.url);
    return u.protocol === 'https:' && !u.username && !u.password &&
      !/(?:avatar|favicon|qrcode|\/logo[/.\-_]|\/icon[/.\-_])/i.test(u.pathname) && !/二维码|扫码登录/.test(image.context);
  } catch { return false; }
}
