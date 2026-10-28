import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { basePath as base, siteUrl as origin } from '../../src/lib/site';
import { activeLineups, allLineups, historyLineups } from '../../src/lib/data';
import { additionalStaticPages } from '../../src/lib/static-pages';
import { PAGE_SIZE } from '../../src/lib/collection-filter';
const root = resolve('dist');
async function walk(dir: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((f) =>
        f.isDirectory() ? walk(join(dir, f.name)) : Promise.resolve([join(dir, f.name)]),
      ),
    )
  ).flat();
}
const all = await walk(root),
  pages = all.filter((f) => f.endsWith('.html'));
if (!pages.some((f) => /[\\/]timeline[\\/]index\.html$/.test(f))) throw Error('缺少配置时间线页面');
if (!pages.some((f) => /[\\/]compare[\\/]index\.html$/.test(f))) throw Error('缺少阵容对比页面');
if (!pages.some((f) => /[\\/]systems[\\/]index\.html$/.test(f))) throw Error('缺少体系共现页面');
for (const [kind, lineups] of [
  ['active', activeLineups],
  ['history', historyLineups],
] as const) {
  const indexPath = join(root, `collection-index-${kind}.json`);
  const entries: { slug: string; index: number }[] = JSON.parse(await readFile(indexPath, 'utf8'));
  if (
    entries.length !== lineups.length ||
    entries.some((entry, index) => entry.slug !== lineups[index].slug || entry.index !== index)
  )
    throw Error(`${kind} 索引与列表顺序不一致`);
  const historical = kind === 'history';
  const pagePath = (number: number) =>
    `${base}${historical ? '/history' : ''}${number === 1 ? '/' : `/page/${number}/`}`;
  const pageNumbers = [1, ...additionalStaticPages(lineups.length)];
  for (const page of pageNumbers) {
    const path =
      page === 1
        ? join(root, ...(historical ? ['history'] : []), 'index.html')
        : join(root, ...(historical ? ['history'] : []), 'page', String(page), 'index.html');
    const $ = cheerio.load(await readFile(path, 'utf8'));
    const rendered = $('[data-collection] [data-card]')
      .toArray()
      .map((el) => $(el).attr('id'));
    const expected = lineups
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((lineup) => `lineup-${lineup.slug}`);
    if (JSON.stringify(rendered) !== JSON.stringify(expected))
      throw Error(`${kind} 静态第 ${page} 页与索引顺序不一致`);
    if (historical && $('[data-season-filter="all"]').length !== 1)
      throw Error(`历史静态第 ${page} 页缺少赛季筛选`);
    const range = `第 ${page} / ${pageNumbers.length} 页（第 ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, lineups.length)} 套）`;
    if (pageNumbers.length > 1 && !$('#result-count').text().includes(range))
      throw Error(`${kind} 静态第 ${page} 页的结果范围不正确`);
    const links = $('nav.static-pagination a')
      .toArray()
      .map((el) => $(el).attr('href'));
    const expectedLinks = [
      ...(page > 1 ? [pagePath(page - 1)] : []),
      ...pageNumbers.filter((number) => number !== page).map(pagePath),
      ...(page < pageNumbers.length ? [pagePath(page + 1)] : []),
    ];
    if (JSON.stringify(links) !== JSON.stringify(expectedLinks))
      throw Error(`${kind} 静态第 ${page} 页的分页链接不完整`);
    if (
      $('nav.static-pagination [aria-current="page"]').length !== (pageNumbers.length > 1 ? 1 : 0)
    )
      throw Error(`${kind} 静态第 ${page} 页缺少当前页标记`);
  }
}
if (all.includes(join(root, 'collection-index.json'))) throw Error('旧合并索引未移除');
for (const path of [join(root, 'index.html'), join(root, 'history', 'index.html')]) {
  const $ = cheerio.load(await readFile(path, 'utf8'));
  if (!$('noscript').text().includes('搜索与筛选需要启用脚本'))
    throw Error(`无脚本浏览提示缺失: ${path}`);
  for (const selector of ['#search', '#sort', '#with-video', '[data-filter]'])
    if (
      $(selector)
        .toArray()
        .some((element) => $(element).attr('disabled') === undefined)
    )
      throw Error(`无脚本控件未禁用: ${selector} in ${path}`);
}
for (const lineup of allLineups) {
  const historical = historyLineups.some((entry) => entry.slug === lineup.slug);
  const collection = historical ? historyLineups : activeLineups;
  const index = collection.findIndex((entry) => entry.slug === lineup.slug);
  if (index < 0) throw Error(`阵容缺少所属列表: ${lineup.slug}`);
  const page = Math.floor(index / PAGE_SIZE) + 1;
  const prefix = `${base}${historical ? '/history' : ''}`;
  const expected = `${prefix}${page === 1 ? '/' : `/page/${page}/`}#lineup-${lineup.slug}`;
  const $ = cheerio.load(await readFile(join(root, 'lineups', lineup.slug, 'index.html'), 'utf8'), {
    scriptingEnabled: false,
  });
  if ($('noscript a').filter((_, element) => $(element).attr('href') === expected).length !== 1)
    throw Error(`详情页无脚本返回卡片链接不正确: ${lineup.slug}`);
}
{
  const $ = cheerio.load(await readFile(join(root, 'compare', 'index.html'), 'utf8'));
  const firstTwo = allLineups
    .filter((lineup) => lineup.lineup_images.some((image) => image.verified))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.slug.localeCompare(b.slug))
    .slice(0, 2);
  if ($('#compare-first[disabled], #compare-second[disabled]').length !== 2)
    throw Error('对比页无脚本选择器未禁用');
  for (const [index, panel] of ['#compare-left', '#compare-right'].entries()) {
    if (
      $(panel + ' h2 a').attr('href') !== `${base}/lineups/${firstTwo[index].slug}/` ||
      $(panel + ' .compare-roster > li').length !== 6
    )
      throw Error(`对比页预渲染内容不完整: ${panel}`);
  }
  const verifiedLineups = allLineups.filter((entry) =>
    entry.lineup_images.some((image) => image.verified),
  );
  const catalog = $('#compare-catalog [data-compare-lineup]');
  if (
    catalog.length !== verifiedLineups.length - 2 ||
    catalog.filter('details').length !== catalog.length
  )
    throw Error('对比页无脚本配置目录不完整');
  for (const lineup of verifiedLineups) {
    if (firstTwo.some((entry) => entry.slug === lineup.slug)) continue;
    const item = catalog.filter(
      (_, element) => $(element).attr('data-compare-lineup') === lineup.slug,
    );
    if (
      item.length !== 1 ||
      item.find('summary').length !== 1 ||
      item.find('.compare-catalog-content .compare-roster > li').length !== 6 ||
      item.find('.compare-catalog-content h2 a').attr('href') !== `${base}/lineups/${lineup.slug}/`
    )
      throw Error(`对比页无脚本配置缺失: ${lineup.slug}`);
  }
}
{
  const $ = cheerio.load(await readFile(join(root, 'systems', 'index.html'), 'utf8'));
  if ($('.system-graph-scroll .system-graph').length !== 1) throw Error('体系共现图缺少可滚动容器');
}
{
  const $ = cheerio.load(await readFile(join(root, 'timeline', 'index.html'), 'utf8'));
  const itemList = $('script[type="application/ld+json"]')
    .toArray()
    .map((script) => JSON.parse($(script).text()) as Record<string, unknown>)
    .find((node) => node['@type'] === 'ItemList') as
    | {
        numberOfItems?: number;
        itemListElement?: { position: number; name: string; url: string }[];
      }
    | undefined;
  const links = $('.timeline-list > li a').toArray();
  if (
    !itemList ||
    itemList.numberOfItems !== links.length ||
    itemList.itemListElement?.length !== links.length ||
    itemList.itemListElement.some(
      (entry, index) =>
        entry.position !== index + 1 ||
        entry.name !== $(links[index]).text() ||
        entry.url !== new URL($(links[index]).attr('href')!, `${origin}${base}/`).href,
    )
  )
    throw Error('时间线 ItemList 与可见阵容不一致');
}
let checks = 0;
const siteRoot = `${origin}${base}/`;
const contentPages: string[] = [];
const originalSizes = new Map<string, number>(),
  derivedSizes = new Map<string, number>();
for (const file of all) {
  const rel = file.slice(root.length).replaceAll('\\', '/');
  const original = rel.match(
    /^\/assets\/lineups\/([^/]+)\/([a-f0-9]{64})\.(?:png|jpe?g|webp|avif)$/,
  );
  if (original && original[1] !== 'derived')
    originalSizes.set(original[2], (await stat(file)).size);
  const derived = rel.match(/^\/assets\/lineups\/derived\/([a-f0-9]{64})-(\d+)\.(webp|avif)$/);
  if (derived)
    derivedSizes.set(`${derived[1]}-${derived[2]}.${derived[3]}`, (await stat(file)).size);
}
for (const page of pages) {
  const html = await readFile(page, 'utf8'),
    $ = cheerio.load(html);
  const pageRelative = page
    .slice(root.length)
    .replaceAll('\\', '/')
    .replace(/index\.html$/, '');
  if (/[A-Z]:[\\/](?:Users|Luoke_pvp)|file:\/\//i.test(html)) throw Error(`含本机路径: ${page}`);
  if (
    page.includes(
      `${process.platform === 'win32' ? '\\' : '/'}lineups${process.platform === 'win32' ? '\\' : '/'}`,
    ) &&
    $('a').filter((_, el) => /返回阵容总览|返回往期阵容/.test($(el).text())).length < 2
  )
    throw Error(`详情页缺少双返回: ${page}`);
  for (const el of $('[href], [src]').toArray()) {
    const raw = $(el).attr('href') || $(el).attr('src')!;
    if (!raw || /^(https?:|mailto:|data:|tel:)/.test(raw)) continue;
    if (raw.startsWith('//')) throw Error('不允许协议相对地址');
    const url = new URL(raw, `https://local.test${base}${pageRelative}`);
    if (base && !url.pathname.startsWith(base + '/')) throw Error(`资源缺少 base: ${raw}`);
    let target = resolve(
      root,
      decodeURIComponent(url.pathname.slice(base.length)).replace(/^\//, ''),
    );
    if (!target.startsWith(root)) throw Error('越界链接');
    try {
      const s = await stat(target);
      if (s.isDirectory()) target = join(target, 'index.html');
      await stat(target);
    } catch {
      throw Error(`静态链接缺失 ${raw} in ${page}`);
    }
    if (url.hash && target.endsWith('.html')) {
      const target$ = cheerio.load(await readFile(target, 'utf8'));
      const id = decodeURIComponent(url.hash.slice(1));
      if (
        !target$('[id]')
          .toArray()
          .some((e) => target$(e).attr('id') === id)
      )
        throw Error(`锚点缺失: ${raw}`);
    }
    checks++;
  }
  for (const imageSource of $('img[srcset], source[srcset]').toArray()) {
    for (const entry of ($(imageSource).attr('srcset') || '').split(',')) {
      const raw = entry.trim().split(/\s+/)[0];
      if (!raw) continue;
      const url = new URL(raw, `https://local.test${base}${pageRelative}`);
      if (base && !url.pathname.startsWith(base + '/')) throw Error(`派生图缺少 base: ${raw}`);
      const match = url.pathname.match(
        /\/assets\/lineups\/derived\/([a-f0-9]{64})-(\d+)\.(webp|avif)$/,
      );
      if (!match) throw Error(`未知派生图路径: ${raw}`);
      const target = resolve(
        root,
        decodeURIComponent(url.pathname.slice(base.length)).replace(/^\//, ''),
      );
      if (!target.startsWith(root)) throw Error('越界链接');
      try {
        await stat(target);
      } catch {
        throw Error(`派生图缺失 ${raw} in ${page}`);
      }
      const original = originalSizes.get(match[1]),
        size = derivedSizes.get(`${match[1]}-${match[2]}.${match[3]}`);
      if (original !== undefined && size !== undefined && size >= original)
        throw Error(`派生图未小于原图: ${raw}`);
      checks++;
    }
  }
  for (const img of $('img').toArray())
    if (!$(img).attr('width') || !$(img).attr('height') || !$(img).attr('alt'))
      throw Error(`图片缺少尺寸或 alt: ${page}`);
  const isRedirect = $('meta[http-equiv="refresh" i]').length > 0;
  const route = pageRelative || '/';
  if (!isRedirect && !route.endsWith('404.html')) {
    const expected = new URL(route.replace(/^\//, ''), siteRoot).href;
    const canonical = $('link[rel="canonical"]').attr('href'),
      description = $('meta[name="description"]').attr('content')?.trim();
    const ogUrl = $('meta[property="og:url"]').attr('content'),
      ogImage = $('meta[property="og:image"]').attr('content');
    if (!canonical || canonical !== expected)
      throw Error(`canonical 缺失或不匹配: ${page} -> ${canonical}（期望 ${expected}）`);
    if (!description) throw Error(`description 为空: ${page}`);
    if (!ogUrl || ogUrl !== canonical) throw Error(`og:url 缺失或与 canonical 不一致: ${page}`);
    if (!ogImage) throw Error(`og:image 缺失: ${page}`);
    const imageUrl = new URL(ogImage);
    if (imageUrl.origin !== origin) throw Error(`og:image 不是本站绝对地址: ${ogImage}`);
    if (base && !imageUrl.pathname.startsWith(base + '/'))
      throw Error(`og:image 缺少 base: ${ogImage}`);
    const imagePath = resolve(
      root,
      decodeURIComponent(imageUrl.pathname.slice(base.length)).replace(/^\//, ''),
    );
    if (!imagePath.startsWith(root)) throw Error('og:image 越界');
    try {
      await stat(imagePath);
    } catch {
      throw Error(`og:image 文件缺失: ${ogImage}`);
    }
    const schemas = $('script[type="application/ld+json"]')
      .toArray()
      .map((script): unknown => {
        try {
          return JSON.parse($(script).text());
        } catch {
          throw Error(`JSON-LD 无法解析: ${page}`);
        }
      });
    if (route !== '/' && !route.startsWith('/updates/')) {
      const breadcrumb = schemas.find(
        (node) =>
          typeof node === 'object' &&
          node !== null &&
          (node as Record<string, unknown>)['@type'] === 'BreadcrumbList',
      ) as { itemListElement?: { item: string; name: string; position: number }[] } | undefined;
      const items = breadcrumb?.itemListElement;
      if (
        !Array.isArray(items) ||
        items.length < 2 ||
        items[0].item !== siteRoot ||
        items.at(-1)?.item !== expected ||
        items.some((item, index) => !item.name || item.position !== index + 1)
      )
        throw Error(`面包屑结构化数据缺失或地址不匹配: ${page}`);
    }
    checks += 4;
    if (!route.includes('/updates/')) contentPages.push(expected);
  }
}
const sitemapFiles = all.filter((f) => /\/sitemap-\d+\.xml$/.test(f.replaceAll('\\', '/')));
if (sitemapFiles.length === 0) throw Error('缺少 sitemap');
const locs = new Set(
  (await Promise.all(sitemapFiles.map((f) => readFile(f, 'utf8')))).flatMap((xml) =>
    [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
  ),
);
for (const url of contentPages) if (!locs.has(url)) throw Error(`sitemap 未覆盖: ${url}`);
for (const url of locs)
  if (/\/(404|updates)\/?$/.test(new URL(url).pathname))
    throw Error(`sitemap 含不应收录的页面: ${url}`);
try {
  const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
  if (!robots.includes(`${siteRoot}sitemap-index.xml`))
    throw Error('robots.txt 的 sitemap 地址不正确');
} catch (e) {
  throw e instanceof Error ? e : Error('robots.txt 缺失');
}
console.log(
  `静态站点检查通过：${pages.length} 页（${contentPages.length} 页收录），${checks} 个站内链接/资源/元数据，sitemap ${locs.size} 条，base=${base || '/'}`,
);
