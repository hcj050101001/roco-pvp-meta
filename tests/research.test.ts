import test from 'node:test';
import assert from 'node:assert/strict';
import { queryPlan, selectedSeasons, sourceFor, balancedSources, mergeSources, candidateImage } from '../scripts/collect/strategy';
import { ingestSearch, discover } from '../scripts/collect/search';
import { extractPage } from '../scripts/extract/page';
import { coverage } from '../scripts/research/coverage';
import { allLineups } from '../src/lib/data';
import { sourceDocument } from '../scripts/collect/page';

test('浏览器重定向使用最终页面 URL；失败时成对保留普通抓取页面及 URL', async () => {
  const html = `<article>${'公开配队内容'.repeat(60)}<img src="images/team.png"><a href="next/">配队</a></article>`;
  const fetcher = async () => ({ body: Buffer.from(html), type: 'text/html', url: 'https://example.com/fetch/page' });
  const snapshotter = async () => ({ html, screenshot: Buffer.from('screenshot'), url: 'https://example.com/browser/page' });
  const document = await sourceDocument('https://example.com/entry', { browser: true, fetcher, snapshotter });
  const page = extractPage(document.html, document.url);
  assert.equal(page.images[0].url, 'https://example.com/browser/images/team.png');
  assert.equal(page.related_links[0].url, 'https://example.com/browser/next/');
  assert.equal(document.browser_error, null);
  for (const fail of [
    async () => { throw Error('浏览器失败'); },
    async () => ({ ...await snapshotter(), html: '<title>安全验证</title>' }),
  ]) {
    const fallback = await sourceDocument('https://example.com/entry', { browser: true, fetcher, snapshotter: fail });
    assert.equal(fallback.html, html);
    assert.equal(fallback.url, 'https://example.com/fetch/page');
    assert.equal(fallback.screenshot, undefined);
    assert.ok(fallback.browser_error);
  }
});

test('全部赛季与历史模式保留旧赛季，显式历史查询不会改写为当季', () => {
  assert.deepEqual(selectedSeasons('S4', ['S2', 'S3', 'S4'], 'all'), ['S4', 'S3', 'S2']);
  assert.deepEqual(selectedSeasons('S4', ['S2', 'S3', 'S4'], 'history'), ['S3', 'S2']);
  assert.throws(() => selectedSeasons('S4', [], 'all; rm'), /scope/);
  const plan = queryPlan(['洛克王国 {season} 阵容', '洛克王国 S2 狼王'], ['S4', 'S3', 'S2']);
  assert.ok(plan.some(q => q.query === '洛克王国 S2 狼王'));
  assert.ok(!plan.some(q => q.query === '洛克王国 S4 狼王'));
  assert.equal(plan.find(q => q.query === '洛克王国 S2 狼王')?.season, 'S2');
  assert.ok(!queryPlan(['洛克王国 S2 狼王'], ['S4']).some(q => q.query === '洛克王国 S2 狼王'));
  for (const season of ['S2', 'S3', 'S4']) assert.ok(plan.filter(q => q.season === season).length >= 8);
});

test('大量单站结果不能挤占其他平台或历史赛季，超预算保留待续查', () => {
  const flood = Array.from({ length: 30 }, (_, i) => sourceFor(`https://ol.3dmgame.com/gl/${i}.html`, ['S4'], 'search')!);
  const old = sourceFor('https://ol.3dmgame.com/gl/old.html', ['S2'], 'search')!;
  const community = sourceFor('https://www.taptap.cn/moment/123', ['S3'], 'search')!;
  const result = balancedSources([...flood, old, community], ['S4', 'S3', 'S2'], 3);
  assert.ok(result.selected.some(s => s.url === old.url));
  assert.ok(result.selected.some(s => s.url === community.url));
  assert.equal(result.deferred.length, 29);
  const merged = mergeSources([old, { ...old, seasons: ['S3'], pending_image_urls: ['https://images.example/next.jpg'] }]);
  assert.equal(merged.length, 1); assert.deepEqual(merged[0].seasons, ['S2', 'S3']);
  assert.deepEqual(merged[0].pending_image_urls, ['https://images.example/next.jpg']);
});

test('公开来源不接受伪装域、凭证 URL、非 HTTPS 或额外端口', () => {
  for (const u of ['https://taptap.cn.evil.test/x', 'https://user:pass@www.taptap.cn/x', 'http://www.taptap.cn/x', 'https://www.taptap.cn:444/x'])
    assert.equal(sourceFor(u, ['S3'], 'test'), null);
});

test('Bing 网页追踪链接解码后再次限制来源，只提取结果区域', () => {
  const url = 'https://www.gamersky.com/handbook/lineup.shtml';
  const encoded = 'https://www.bing.com/ck/a?u=a1' + Buffer.from(url).toString('base64url');
  const bad = 'https://www.bing.com/ck/a?u=a1' + Buffer.from('https://taptap.cn.evil.test/x').toString('base64url');
  assert.deepEqual(ingestSearch(`<a href="https://qiandao.com/nav">导航</a><li class="b_algo"><h2><a href="${encoded}">配队</a></h2></li><li class="b_algo"><h2><a href="${bad}">伪装</a></h2></li>`), [url]);
});

test('RSS 无支持结果时尝试 HTML；两者失败不能记为发现成功', async () => {
  const calls: string[] = [], saved: string[] = [];
  const result = await discover([{ query: 'S3 配队', season: 'S3', platform: 'taptap' }], async name => { saved.push(name); }, async url => {
    calls.push(url);
    return { body: Buffer.from(url.includes('format=rss') ? '<rss><channel></channel></rss>' : '<li class="b_algo"><h2><a href="https://www.taptap.cn/moment/1">洛克王国 S3 配队</a></h2></li>'), type: 'text/html', url };
  });
  assert.equal(calls.length, 2); assert.equal(saved.length, 2);
  assert.deepEqual(result.urls, ['https://www.taptap.cn/moment/1']);
  assert.equal(result.records[0].season, 'S3');
  assert.deepEqual(result.health.map(h => h.status), ['no_supported_results', 'ok']);
  const fail = await discover([{ query: 'S2 配队', season: 'S2', platform: 'any' }], async () => {}, async () => { throw Error('HTTP 403'); });
  assert.equal(fail.urls.length, 0); assert.ok(fail.health.every(h => h.status === 'source_fetch_failed'));
  assert.deepEqual(ingestSearch('<li class="b_algo"><h2><a href="https://www.gamersky.com/other">其他游戏配队</a></h2></li>', true), []);
});

test('通用图片与相关配队链接不依赖 3DM 路径，正文图片优先', () => {
  const page = extractPage('<nav><img src="/nav.jpg"></nav><article><h1>S2 配队</h1><img data-src="https://img.gamersky.com/new/roster.jpg"><a href="/history/123">S2 雨天队阵容</a><a href="javascript:alert(1)">配队</a></article>', 'https://www.gamersky.com/post');
  assert.equal(page.images[0].url, 'https://img.gamersky.com/new/roster.jpg');
  assert.ok(candidateImage(page.images[0]));
  assert.equal(candidateImage({ url: 'https://cdn.example.org/avatar/me.jpg', context: '' }), false);
  assert.deepEqual(page.related_links, [{ url: 'https://www.gamersky.com/history/123', title: 'S2 雨天队阵容' }]);
});

test('覆盖报告区分尝试、失败、唯一图和已收录图，不把单站重复计为多元', () => {
  const hash = allLineups[0].lineup_images[0].sha256;
  const report = coverage({ run_id: 'test', target_seasons: ['S3', 'S4'], sources: [
    { url: 'https://ol.3dmgame.com/gl/1', status: 'ok', seasons: ['S3'], images: [{ sha256: hash }, { sha256: hash }] },
    { url: 'https://www.taptap.cn/moment/1', status: 'source_fetch_failed', images: [{ sha256: 'x' }] },
  ] }, allLineups);
  assert.equal(report.successful_image_platforms, 1);
  assert.equal(report.status, 'limited-source-coverage');
  const row = report.platforms.find(p => p.platform === '3dm')!;
  assert.equal(row.unique_images, 1); assert.equal(row.unpublished_images, 0);
  assert.equal(report.platforms.find(p => p.platform === 'taptap')!.image_sources, 0);
  assert.equal(coverage({ run_id: 'empty', sources: [] }, []).status, 'no-image-evidence');
});
