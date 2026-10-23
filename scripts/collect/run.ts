import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { extractPage } from '../extract/page';
import { publicFetch } from './network';
import { imageInfo } from '../extract/image';
import { discover } from './search';
import { publicBrowserSnapshot } from './browser';
import { loadSeasons, loadState, readLineups } from '../../src/lib/data';
import { sourceFor, mergeSources, balancedSources, selectedSeasons, queryPlan, candidateImage, retrySource, remainingImages, unprocessedImages, processedImages, type Source } from './strategy';
import policy from '../../data/research-policy.json';

type DownloadRecord = {
  url: string; context?: string; method?: string; order?: number;
  sha256?: string; width?: number; height?: number; format?: string; phash?: string;
  file?: string; verified: boolean; mapping_confidence?: string; error?: string;
};
type SourceRecord = Source & {
  status: 'ok' | 'source_fetch_failed';
  resolved_url?: string; title?: string; evidence_hash?: string;
  images?: DownloadRecord[]; image_nodes?: number;
  deferred_images?: { url: string; context: string; method: string; order: number }[];
  browser_error?: string | null; checked_at: string; error?: string;
};
type Seed = { url: string; enabled: boolean; seasons?: string[] };
type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const errorMessage = (error: unknown) => String(error);
const isEnoent = (error: unknown) => error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';

const option = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw Error(`缺少 ${name} 参数`);
  return process.argv[i + 1];
};
const state = loadState();
const known = loadSeasons();
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
const rawSeeds: unknown = JSON.parse(await readFile('data/sources.json', 'utf8'));
if (!Array.isArray(rawSeeds)) throw Error('sources.json 必须是数组');
const seeds: Seed[] = rawSeeds.flatMap(s => isRecord(s) && typeof s.url === 'string'
  ? [{ url: s.url, enabled: s.enabled === true, seasons: Array.isArray(s.seasons) ? stringArray(s.seasons) : undefined }]
  : []);
for (const s of seeds.filter(s => s.enabled)) add(s.url, s.seasons ?? sourceSeasons(s.url), 'seed');
// Explicit expansion seeds and old-season evidence are part of every scheduled run.
const seedFile = option('--seeds', 'research/expansion-seeds.json');
const rawExpansion: unknown = JSON.parse(await readFile(seedFile, 'utf8'));
if (!Array.isArray(rawExpansion)) throw Error(`${seedFile} 必须是数组`);
for (const s of rawExpansion) {
  if (typeof s === 'string') add(s, sourceSeasons(s), 'expansion');
  else if (isRecord(s) && typeof s.url === 'string') add(s.url, Array.isArray(s.seasons) ? stringArray(s.seasons) : sourceSeasons(s.url), 'expansion');
}
const backlogFile = 'research/candidates/discovery-backlog.json';
const carriedBacklog: Source[] = [];
try {
  const backlogData: unknown = JSON.parse(await readFile(backlogFile, 'utf8'));
  if (!isRecord(backlogData) || !Array.isArray(backlogData.sources)) throw Error('discovery-backlog.json 格式错误');
  for (const s of backlogData.sources) {
    if (!isRecord(s) || typeof s.url !== 'string') continue;
    const entry = sourceFor(s.url, stringArray(s.seasons), 'backlog');
    if (!entry) continue;
    entry.pending_image_urls = stringArray(s.pending_image_urls);
    entry.processed_image_urls = stringArray(s.processed_image_urls);
    if (typeof s.evidence_hash === 'string' && /^[a-f0-9]{64}$/.test(s.evidence_hash)) entry.evidence_hash = s.evidence_hash;
    entry.attempts = typeof s.attempts === 'number' && Number.isInteger(s.attempts) && s.attempts > 0 ? Math.min(s.attempts, 100) : 0;
    if (typeof s.retry_after === 'string' && Number.isFinite(Date.parse(s.retry_after))) entry.retry_after = new Date(s.retry_after).toISOString();
    const otherSeasons=entry.seasons.filter(season=>!seasons.includes(season));
    if(otherSeasons.length)carriedBacklog.push(entry.seasons.some(season=>seasons.includes(season))
      ? {...entry,seasons:otherSeasons,pending_image_urls:[],processed_image_urls:[],evidence_hash:undefined,attempts:0,retry_after:undefined}
      : entry);
    if(entry.seasons.some(season=>seasons.includes(season)))sources.push({ ...entry, seasons: entry.seasons.filter(season => seasons.includes(season)) });
  }
} catch (e) { if (!isEnoent(e)) throw e; }
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
carriedBacklog.push(...sources.filter(s => s.retry_after && Date.parse(s.retry_after) > Date.now()));
sources = sources.filter(s => !s.retry_after || Date.parse(s.retry_after) <= Date.now());
const initial = balancedSources(sources, seasons, policy.max_pages);
const queue = [...initial.selected], deferred = [...initial.deferred];
const seen = new Set([...queue.map(s => s.url), ...carriedBacklog.filter(s=>s.retry_after && Date.parse(s.retry_after)>Date.now()).map(s=>s.url)]);
const records: SourceRecord[] = [];
const related: Source[] = [];
const imageBacklog: Source[] = [];
const failedSources: Source[] = [];
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
    const evidence_hash = createHash('sha256').update(JSON.stringify([extracted.title, extracted.text, extracted.metadata, extracted.public_comments, extracted.videos])).digest('hex');
    await writeFile(join(folder, 'page.json'), JSON.stringify(extracted, null, 2) + '\n');
    const downloads: DownloadRecord[] = [];
    const pending = new Set(source.pending_image_urls ?? []);
    const pendingOrder = new Map([...pending].map((url,index)=>[url,index]));
    const candidates = unprocessedImages([...extracted.images, ...[...pending].filter(url => !extracted.images.some(i => i.url === url)).map(url => ({url, context:'待续原图', method:'backlog', order:0}))]
      .filter(candidateImage),source,evidence_hash).sort((a, b) => (pendingOrder.get(a.url)??Infinity)-(pendingOrder.get(b.url)??Infinity));
    const completed: string[] = [];
    const failedImages: string[] = [];
    for (const img of candidates.slice(0, policy.max_images_per_page)) {
      try {
        const res = await publicFetch(img.url, 12_000_000, 15000);
        if (!res.type.startsWith('image/')) throw Error('非图片响应');
        const info = await imageInfo(res.body);
        completed.push(img.url);
        if (info.width < 300 || info.height < 200) continue;
        const file = `${info.sha256}.${info.format === 'jpeg' ? 'jpg' : info.format}`;
        if (!/\.(png|jpe?g|webp|avif)$/.test(file)) continue;
        await writeFile(join(folder, file), res.body);
        downloads.push({ ...img, ...info, file, verified: false, mapping_confidence: 'unverified' });
      } catch (e) { failedImages.push(img.url); downloads.push({ ...img, error: errorMessage(e), verified: false }); }
    }
    const pendingImages = remainingImages([...candidates.slice(policy.max_images_per_page).map(i => i.url),...pending], completed.filter(url => !failedImages.includes(url)), failedImages);
    const processed = processedImages(source,evidence_hash);
    imageBacklog.push({ ...source, evidence_hash, processed_image_urls:[...new Set([...processed,...completed.filter(url=>!failedImages.includes(url))])],
      attempts:0, retry_after:pendingImages.length?undefined:new Date(Date.now()+14*86400000).toISOString(), pending_image_urls:pendingImages });
    for (const [i, link] of extracted.related_links.entries()) {
      const s = sourceFor(link.url, source.seasons, 'related-link');
      if (s && !seen.has(s.url)) (i < policy.max_related_per_page ? related : deferred).push(s);
    }
    records.push({ ...source, status: 'ok', resolved_url: r.url, title: extracted.title, evidence_hash, images: downloads,
      image_nodes: extracted.images.length, deferred_images: candidates.slice(policy.max_images_per_page),
      browser_error: browserError, checked_at: new Date().toISOString() });
    console.log(`${source.platform} ${source.url}: ${downloads.filter(i => i.sha256).length} 张未核验候选图${browserError ? '；浏览器补充失败' : ''}`);
  } catch (e) {
    failedSources.push(retrySource(source));
    records.push({ ...source, status: 'source_fetch_failed', error: errorMessage(e), checked_at: new Date().toISOString() });
    console.log(`${source.platform}: ${errorMessage(e)}`);
  }
  // Discover from all initial platforms first, then distribute remaining slots fairly.
  if (index === queue.length - 1 && related.length) {
    const extras = balancedSources(related.filter(s => !seen.has(s.url)), seasons, policy.max_pages - queue.length);
    for (const s of extras.selected) { queue.push(s); seen.add(s.url); }
    deferred.push(...extras.deferred); related.length = 0;
  }
}
const backlog = mergeSources([...carriedBacklog, ...deferred.filter(s => !seen.has(s.url)), ...imageBacklog, ...failedSources]);
await mkdir('research/candidates', { recursive: true });
await writeFile(backlogFile, JSON.stringify({ run_id: runId, untrusted: true, sources: backlog }, null, 2) + '\n');
await writeFile(join(root, 'manifest.json'), JSON.stringify({ run_id: runId, created_at: new Date().toISOString(),
  untrusted: true, scope, target_seasons: seasons, policy, search_health: searchHealth, sources: records,
  deferred_sources: backlog, note: '查询赛季只是发现范围，不是图片所属赛季的证据。' }, null, 2) + '\n');
await writeFile(resolve('research/inbox/latest.json'), JSON.stringify({ run_id: runId }) + '\n');
console.log(`研究记录：${root}；${records.length} 个来源，${backlog.length} 个链接待续查；不会自动认证或改动生产阵容。`);
