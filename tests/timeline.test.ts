import test from 'node:test';
import assert from 'node:assert/strict';
import type { Lineup } from '../src/lib/schema';
import { timelineLineups } from '../src/lib/timeline';

const lineup = (slug: string, date: string | null, verified = true) =>
  ({ slug, lineup_images: [{ published_at: date, verified }] }) as Lineup;

test('时间线按配置发布日期跨赛季排列，未标注日期保留在末尾', () => {
  const items = [
    lineup('unknown', null),
    lineup('older', '2026-01-01T00:00:00Z'),
    lineup('newer', '2026-02-01T00:00:00Z'),
    lineup('unverified', '2026-03-01T00:00:00Z', false),
  ];
  assert.deepEqual(
    timelineLineups(items).map((item) => item.slug),
    ['newer', 'older', 'unknown'],
  );
  assert.equal(items[0].slug, 'unknown');
});
