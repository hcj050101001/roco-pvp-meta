import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as cheerio from 'cheerio';
import { basePath as base, siteUrl as origin } from '../../src/lib/site';
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
  const derived = rel.match(/^\/assets\/lineups\/derived\/([a-f0-9]{64})-(\d+)\.webp$/);
  if (derived) derivedSizes.set(`${derived[1]}-${derived[2]}`, (await stat(file)).size);
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
  for (const img of $('img[srcset]').toArray()) {
    for (const entry of ($(img).attr('srcset') || '').split(',')) {
      const raw = entry.trim().split(/\s+/)[0];
      if (!raw) continue;
      const url = new URL(raw, `https://local.test${base}${pageRelative}`);
      if (base && !url.pathname.startsWith(base + '/')) throw Error(`派生图缺少 base: ${raw}`);
      const match = url.pathname.match(/\/assets\/lineups\/derived\/([a-f0-9]{64})-(\d+)\.webp$/);
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
        size = derivedSizes.get(`${match[1]}-${match[2]}`);
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
    for (const script of $('script[type="application/ld+json"]').toArray()) {
      try {
        JSON.parse($(script).text());
      } catch {
        throw Error(`JSON-LD 无法解析: ${page}`);
      }
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
