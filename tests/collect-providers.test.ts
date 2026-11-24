import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSearxngResults } from '../scripts/collect/providers/searxng';
import { parseBilibiliSearch } from '../scripts/collect/providers/bilibili';
import { parseSo360Results } from '../scripts/collect/providers/so360';
import { parseSogouResults } from '../scripts/collect/providers/sogou';
import { parseTiebaSearch } from '../scripts/collect/providers/tieba';
import { extractWithAdapter } from '../scripts/collect/adapters';
import { queryPlan } from '../scripts/collect/strategy';
import { deploymentTarget } from '../src/lib/site';

test('SearXNG 解析仅保留洛克相关且受支持平台的结果，并保留发布时间', () => {
  const payload = {
    results: [
      {
        url: 'https://www.taptap.cn/moment/999',
        title: '洛克王国世界 S5 圣龙宝藏最新配队',
        content: '一图流完整配置',
        publishedDate: '2026-11-20T10:00:00Z',
      },
      {
        url: 'https://unknown.example.com/post/1',
        title: '洛克王国世界配队',
        content: '不在白名单域名内',
      },
      {
        url: 'https://www.gamersky.com/news/1.html',
        title: '其他游戏攻略',
        content: '无关内容',
      },
    ],
  };
  const records = parseSearxngResults(payload, {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'any',
    freshness: 'month',
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].url, 'https://www.taptap.cn/moment/999');
  assert.equal(records[0].published_at, '2026-11-20T10:00:00Z');
  assert.equal(records[0].provider, 'searxng');
});

test('Bilibili 原生搜索解析支持视频与专栏，并转换 pubdate', () => {
  const videoPayload = {
    code: 0,
    data: {
      result: [
        { bvid: 'BV1xx411c7mD', title: '<em>洛克王国</em>世界 S5 阵容', pubdate: 1795000000 },
        { bvid: 'BV1yy411c7mE', title: '无关视频', pubdate: 1795000000 },
      ],
    },
  };
  const videos = parseBilibiliSearch(videoPayload, 'video', {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'bilibili',
  });
  assert.equal(videos.length, 1);
  assert.equal(videos[0].url, 'https://www.bilibili.com/video/BV1xx411c7mD');
  assert.ok(videos[0].published_at?.startsWith('2026-'));

  const articlePayload = {
    code: 0,
    data: {
      result: [{ id: 123456, title: '洛克王国世界一图流', publish_time: 1795000000 }],
    },
  };
  const articles = parseBilibiliSearch(articlePayload, 'article', {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'bilibili',
  });
  assert.equal(articles.length, 1);
  assert.equal(articles[0].url, 'https://www.bilibili.com/read/cv123456');
});

test('Bilibili 页面适配器从 __INITIAL_STATE__ 补充封面、作者、视频链接和发布时间', () => {
  const html = `
    <html>
      <head><title>测试页面</title></head>
      <body>
        <script>
          window.__INITIAL_STATE__ = ${JSON.stringify({
            videoData: {
              bvid: 'BV1ab411c7mZ',
              title: 'S5 圣龙宝藏上分六人队',
              desc: '完整配置见置顶评论',
              pic: '//i0.hdslb.com/bfs/archive/test.jpg',
              pubdate: 1795000000,
              owner: { name: '测试作者' },
            },
          })};
        </script>
      </body>
    </html>
  `;
  const extracted = extractWithAdapter(
    html,
    'https://www.bilibili.com/video/BV1ab411c7mZ',
    'bilibili',
  );
  assert.equal(extracted.title, 'S5 圣龙宝藏上分六人队');
  assert.equal(extracted.metadata.author, '测试作者');
  assert.ok(extracted.metadata.published_at?.startsWith('2026-'));
  assert.equal(extracted.images[0].url, 'https://i0.hdslb.com/bfs/archive/test.jpg');
  assert.equal(extracted.videos[0].url, 'https://www.bilibili.com/video/BV1ab411c7mZ');
});

test('时效性查询计划为当前赛季补充最新搜索词，且不改写旧季查询', () => {
  const plan = queryPlan(['洛克王国世界 {season} 配队'], ['S5', 'S2'], {
    freshness: 'month',
    currentSeason: 'S5',
    seasonName: '圣龙宝藏',
  });
  assert.ok(plan.some((q) => q.query.includes('S5 圣龙宝藏 最新') && q.freshness === 'month'));
  assert.ok(plan.some((q) => q.season === 'S2' && q.freshness === 'all'));
});

test('360/搜狗/贴吧解析过滤无关内容并保留受支持平台链接', () => {
  const soHtml = `
    <li class="res-list"><h3><a href="https://www.douyin.com/video/7400001">洛克王国世界 S5 抖音配队</a></h3></li>
    <li class="res-list"><h3><a href="https://www.douyin.com/video/7400002">其他游戏视频</a></h3></li>
  `;
  const soRecords = parseSo360Results(soHtml, {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'douyin',
  });
  assert.equal(soRecords.length, 1);
  assert.equal(soRecords[0].url, 'https://www.douyin.com/video/7400001');

  const sogouHtml = `
    <div class="vrwrap"><h3><a href="https://www.xiaohongshu.com/explore/abc">洛克王国世界 S5 小红书阵容</a></h3></div>
    <div class="vrwrap"><h3><a href="/link?url=opaque">洛克王国跳转</a></h3></div>
  `;
  const sogouRecords = parseSogouResults(sogouHtml, {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'xiaohongshu',
  });
  assert.equal(sogouRecords.length, 1);
  assert.equal(sogouRecords[0].url, 'https://www.xiaohongshu.com/explore/abc');

  const tiebaHtml = `
    <div class="s_post"><a href="/p/912345678?pid=1">洛克王国世界 S5 配队一图流</a></div>
  `;
  const tiebaRecords = parseTiebaSearch(tiebaHtml, {
    query: '洛克王国世界 S5',
    season: 'S5',
    platform: 'tieba',
  });
  assert.equal(tiebaRecords.length, 1);
  assert.equal(tiebaRecords[0].url, 'https://tieba.baidu.com/p/912345678');
});

test('抖音适配器提取公开 OpenGraph 封面与视频链接', () => {
  const html = `
    <html><head>
      <meta property="og:title" content="洛克王国世界 S5 圣龙配队" />
      <meta property="og:image" content="https://p3-sign.douyinpic.com/cover.jpg" />
    </head><body></body></html>
  `;
  const extracted = extractWithAdapter(html, 'https://www.douyin.com/video/7400001', 'douyin');
  assert.equal(extracted.title, '洛克王国世界 S5 圣龙配队');
  assert.equal(extracted.images[0].url, 'https://p3-sign.douyinpic.com/cover.jpg');
  assert.equal(extracted.videos[0].url, 'https://www.douyin.com/video/7400001');
});

test('默认部署目标在非 GitHub Actions 环境下为 server', () => {
  if (!process.env.GITHUB_ACTIONS) {
    assert.equal(deploymentTarget, 'server');
  }
});
