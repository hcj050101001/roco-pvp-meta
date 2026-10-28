import test from 'node:test';
import assert from 'node:assert/strict';
import type { Lineup } from '../src/lib/schema';
import { ranked, seasonNumber, signalPriority } from '../src/lib/rank';

const now = Date.parse('2026-10-28T12:00:00.000Z');

function lineup(overrides: Partial<Lineup> = {}): Lineup {
  return {
    slug: 'team',
    season: 'S1',
    signals: [],
    lineup_images: [{ published_at: null }],
    ...overrides,
  } as Lineup;
}

test('seasonNumber 读取 S 前缀数字，无效编号回落为 0', () => {
  assert.equal(seasonNumber('S12'), 12);
  assert.equal(seasonNumber('s3'), 3);
  assert.equal(seasonNumber('unknown'), 0);
});

test('signalPriority 在 45 天窗口内区分 high-rank 和普通热度', () => {
  assert.equal(signalPriority(lineup({ signals: [
    { kind: 'engagement', observed_at: new Date(now - 45 * 86400000).toISOString() },
  ] as Lineup['signals'] }), now), 1);
  assert.equal(signalPriority(lineup({ signals: [
    { kind: 'high-rank', observed_at: new Date(now - 10 * 86400000).toISOString() },
    { kind: 'engagement', observed_at: new Date(now - 1 * 86400000).toISOString() },
  ] as Lineup['signals'] }), now), 2);
});

test('signalPriority 过期、未来和无信号时为 0', () => {
  assert.equal(signalPriority(lineup({ signals: [
    { kind: 'high-rank', observed_at: new Date(now - 45 * 86400000 - 1).toISOString() },
  ] as Lineup['signals'] }), now), 0);
  assert.equal(signalPriority(lineup({ signals: [
    { kind: 'engagement', observed_at: new Date(now + 1).toISOString() },
  ] as Lineup['signals'] }), now), 0);
  assert.equal(signalPriority(lineup(), now), 0);
});

test('ranked 依次按赛季、信号优先级、配置日期和 slug 排序', () => {
  const items = [
    lineup({ slug: 'zeta', season: 'S5', signals: [
      { kind: 'high-rank', observed_at: new Date(now - 1 * 86400000).toISOString() },
    ] as Lineup['signals'], lineup_images: [{ published_at: '2026-10-01T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'older-season', season: 'S4', signals: [
      { kind: 'high-rank', observed_at: new Date(now - 1 * 86400000).toISOString() },
    ] as Lineup['signals'], lineup_images: [{ published_at: '2026-10-10T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'engagement', season: 'S5', signals: [
      { kind: 'engagement', observed_at: new Date(now - 1 * 86400000).toISOString() },
    ] as Lineup['signals'], lineup_images: [{ published_at: '2026-10-20T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'date-newer', season: 'S5', lineup_images: [{ published_at: '2026-10-25T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'date-older', season: 'S5', lineup_images: [{ published_at: '2026-10-24T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'alpha', season: 'S5', lineup_images: [{ published_at: '2026-10-25T00:00:00.000Z' }] as Lineup['lineup_images'] }),
    lineup({ slug: 'beta', season: 'S5', lineup_images: [{ published_at: '2026-10-25T00:00:00.000Z' }] as Lineup['lineup_images'] }),
  ];

  assert.deepEqual(ranked(items, now).map(item => item.slug), [
    'zeta', 'engagement', 'alpha', 'beta', 'date-newer', 'date-older', 'older-season',
  ]);
});
