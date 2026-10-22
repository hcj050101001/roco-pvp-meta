import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { extractPage } from '../extract/page';
import { publicFetch } from './network';
import { imageInfo } from '../extract/image';
import { discover } from './search';
import { publicBrowserSnapshot } from './browser';
import { readLineups } from '../../src/lib/data';
import { sourceFor, mergeSources, balancedSources, selectedSeasons, queryPlan, candidateImage, type Source } from './strategy';
import policy from '../../data/research-policy.json';

const option = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw Error(`缺少 ${name} 参数`);
  return process.argv[i + 1];
};
const state = JSON.parse(await readFile('data/update-state.json', 'utf8'));
const known = JSON.parse(await readFile('data/seasons.json', 'utf8')) as { id: string }[];
const scope = option('--scope', 'all');
const seasons = selectedSeasons(state.season, known.map(s => s.id), scope);
if (!seasons.length) throw Error('所选范围没有已记录赛季');
const lineups = readLineups();
const published = new Set(lineups.flatMap(l => l.sources.map(s => s.url)));
const sourceSeasons = (url: string) => {
  const known = [...new Set(lineups.filter(l => l.sources.some(s => s.url === url)).map(l => l.season))];
  return known.length ? known : seasons;
};
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const root = resolve('research/inbox', runId); await mkdir(root, { recursive: true });
let sources: Source[] = [];
const add = (raw: string, ss: string[], origin: string) => {
  const s = sourceFor(raw, ss.filter(season => seasons.includes(season)), origin);
  if (s?.seasons.length) sources.push(s);
};
const seeds = JSON.parse(await readFile('data/sources.json', 'utf8'));
for (const s of seeds.filter((s: any) => s.enabled)) add(s.url, s.seasons ?? sourceSeasons(s.url), 'seed');
// Explicit expansion seeds and old-season evidence are part of every scheduled run.
const seedFile = option('--seeds', 'research/expansion-seeds.json');
for (const s of JSON.parse(await readFile(seedFile, 'utf8'))) {
  const url = typeof s === 'string' ? s : s.url;
  add(url, s.seasons ?? sourceSeasons(url), 'expansion');
}
const backlogFile = 'research/candidates/discovery-backlog.json';
const carriedBacklog: Source[] = [];
try {
  for (const s of JSON.parse(await readFile(backlogFile, 'utf8')).sources) {
    const entry = sourceFor(s.url, s.seasons, 'backlog');
    if (!entry) continue;
    entry.pending_image_urls = Array.isArray(s.pending_image_urls) ? s.pending_image_urls.filter((u: unknown) => typeof u === 'string') : [];
    if (!entry.seasons.some(season => seasons.includes(season))) carriedBacklog.push(entry);
    else sources.push({ ...entry, seasons: entry.seasons.filter(season => seasons.includes(season)) });
  }
} catch (e: any) { if (e.code !== 'ENOENT') throw e; }
for (const l of lineups) for (const s of l.sources) add(s.url, [l.season], 'published-reference');
let searchHealth: unknown[] = [];
if (process.argv.includes('--discover')) {
  const templates = JSON.parse(await readFile('data/search-queries.json', 'utf8')) as string[];
  const queries = queryPlan(templates, seasons);
  await writeFile(join(root, 'query-plan.json'), JSON.stringify(queries, null, 2) + '\n');
  const found = await discover(queries, (name, body) => writeFile(join(root, name), body));
  searchHealth = found.health;
  for (const r of found.records) add(r.url, r.season === 'unspecified' ? seasons : [r.season], 'search');
}
// Novel evidence gets priority inside each platform/season, never a product collection cap.
sources = mergeSources(sources).sort((a, b) => Number(published.has(a.url)) - Number(published.has(b.url)));
const initial = balancedSources(sources, seasons, policy.max_pages);
const queue = [...initial.selected], deferred = [...initial.deferred];
const seen = new Set(queue.map(s => s.url));
const records: Record<string, any>[] = [];
const related: Source[] = [];
const imageBacklog: Source[] = [];
for (let index = 0; index < queue.length; index++) {
  const source = queue[index];
  const folder = join(root, source.id); await mkdir(folder, { recursive: true });
  try {
    const r = await publicFetch(source.url, 8_000_000); let html = r.body.toString('utf8');
    const visibleTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    if (/访问验证|安全验证|请完成验证|Access Denied|验证码|验证中心/i.test(visibleTitle) || /bili-risk-control|captcha-container/i.test(html) || html.length < 300) throw Error('访问受限或响应不完整');
    let browserError: string | null = null;
    if (process.argv.includes('--browser') && ['qiandao', 'taptap', 'bilibili', 'douyin'].includes(source.platform)) {
      try {
        const snapshot = await publicBrowserSnapshot(source.url);
        html = snapshot.html; await writeFile(join(folder, 'page.png'), snapshot.screenshot);
      } catch (e) { browserError = String(e); } // Keep legitimately retrieved public HTML, never bypass access controls.
    }
    await writeFile(join(folder, 'page.html'), html);
    const extracted = extractPage(html, r.url);
    await writeFile(join(folder, 'page.json'), JSON.stringify(extracted, null, 2) + '\n');
    const downloads = [];
    const pending = new Set(source.pending_image_urls ?? []);
    const candidates = extracted.images.filter(candidateImage).sort((a, b) => Number(pending.has(b.url)) - Number(pending.has(a.url)));
    for (const img of candidates.slice(0, policy.max_images_per_page)) {
      try {
        const res = await publicFetch(img.url, 12_000_000, 15000);
        if (!res.type.startsWith('image/')) throw Error('非图片响应');
        const info = await imageInfo(res.body);
        if (info.width < 300 || info.height < 200) continue;
        const file = `${info.sha256}.${info.format === 'jpeg' ? 'jpg' : info.format}`;
        if (!/\.(png|jpe?g|webp|avif)$/.test(file)) continue;
        await writeFile(join(folder, file), res.body);
        downloads.push({ ...img, ...info, file, verified: false, mapping_confidence: 'unverified' });
      } catch (e) { downloads.push({ ...img, error: String(e), verified: false }); }
    }
    if (candidates.length > policy.max_images_per_page)
      imageBacklog.push({ ...source, pending_image_urls: candidates.slice(policy.max_images_per_page).map(i => i.url) });
    for (const [i, link] of extracted.related_links.entries()) {
      const s = sourceFor(link.url, source.seasons, 'related-link');
      if (s && !seen.has(s.url)) (i < policy.max_related_per_page ? related : deferred).push(s);
    }
    records.push({ ...source, status: 'ok', resolved_url: r.url, title: extracted.title, images: downloads,
      image_nodes: extracted.images.length, deferred_images: candidates.slice(policy.max_images_per_page),
      browser_error: browserError, checked_at: new Date().toISOString() });
    console.log(`${source.platform} ${source.url}: ${downloads.filter(i => 'sha256' in i).length} 张未核验候选图${browserError ? '；浏览器补充失败' : ''}`);
  } catch (e) {
    records.push({ ...source, status: 'source_fetch_failed', error: String(e), checked_at: new Date().toISOString() });
    console.log(`${source.platform}: ${String(e)}`);
  }
  // Discover from all initial platforms first, then distribute remaining slots fairly.
  if (index === queue.length - 1 && related.length) {
    const extras = balancedSources(related.filter(s => !seen.has(s.url)), seasons, policy.max_pages - queue.length);
    for (const s of extras.selected) { queue.push(s); seen.add(s.url); }
    deferred.push(...extras.deferred); related.length = 0;
  }
}
const backlog = mergeSources([...carriedBacklog, ...deferred.filter(s => !seen.has(s.url)), ...imageBacklog]);
await mkdir('research/candidates', { recursive: true });
await writeFile(backlogFile, JSON.stringify({ run_id: runId, untrusted: true, sources: backlog }, null, 2) + '\n');
await writeFile(join(root, 'manifest.json'), JSON.stringify({ run_id: runId, created_at: new Date().toISOString(),
  untrusted: true, scope, target_seasons: seasons, policy, search_health: searchHealth, sources: records,
  deferred_sources: backlog, note: '查询赛季只是发现范围，不是图片所属赛季的证据。' }, null, 2) + '\n');
await writeFile(resolve('research/inbox/latest.json'), JSON.stringify({ run_id: runId }) + '\n');
console.log(`研究记录：${root}；${records.length} 个来源，${backlog.length} 个链接待续查；不会自动认证或改动生产阵容。`);
