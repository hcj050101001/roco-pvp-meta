import test from 'node:test';
import assert from 'node:assert/strict';
import { officialSeason, latestLaunched, type SeasonEvidence } from '../src/lib/season';

function evidence(id: string, name = `季节${id}`): SeasonEvidence {
  return {
    id,
    name,
    started_at: '2026-10-01T00:00:00.000Z',
    source_url: 'https://www.taptap.cn/moment/example',
    theme: 'light',
  };
}

test('latestLaunched 只考虑当前及更新赛季，并返回最高赛季', () => {
  const current = evidence('S5', '当前赛季');
  const newer = evidence('S7', '最新赛季');

  assert.deepEqual(latestLaunched([evidence('S4'), current, evidence('S6'), newer], 'S5'), newer);
});

test('latestLaunched 当前赛季无证据时选择最高的更新赛季', () => {
  const highest = evidence('S8');

  assert.deepEqual(latestLaunched([evidence('S6'), highest, evidence('S7')], 'S5'), highest);
});

test('latestLaunched 空证据或只有旧赛季时返回 null', () => {
  assert.equal(latestLaunched([], 'S5'), null);
  assert.equal(latestLaunched([evidence('S3'), evidence('S4')], 'S5'), null);
});

test('officialSeason 拒绝非字符串发布日期，保留有效公告的判定', () => {
  const article = {
    '@type': 'NewsArticle',
    author: { url: 'https://www.taptap.cn/user/99962293' },
    headline: 'S4赛季「测试」',
    description: '现已开启',
    datePublished: '2026-10-01T00:00:00Z' as unknown,
  };
  const parse = () =>
    officialSeason(
      `<script type="application/ld+json">${JSON.stringify(article)}</script>`,
      'https://www.taptap.cn/moment/example',
      new Date('2026-10-28T00:00:00Z'),
    );
  assert.equal(parse()?.id, 'S4');
  for (const date of [null, false, 0, {}, [], 'invalid']) {
    article.datePublished = date;
    assert.equal(parse(), null);
  }
});
