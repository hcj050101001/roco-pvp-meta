import test from 'node:test';
import assert from 'node:assert/strict';
import type { Lineup } from '../src/lib/schema';
import { systemGraph } from '../src/lib/system-graph';

const lineup = (slug: string, archetype: string[], verified = true) =>
  ({ slug, name: slug, archetype, lineup_images: [{ verified }] }) as Lineup;

test('共现图仅由同一套已核验阵容中的不同标签构成', () => {
  const graph = systemGraph([
    lineup('one', ['雨天', '平衡', '雨天']),
    lineup('two', ['雨天', '平衡']),
    lineup('three', ['雪天']),
    lineup('unverified', ['雨天', '雪天'], false),
  ]);
  assert.deepEqual(graph.systems, ['平衡', '雪天', '雨天']);
  assert.deepEqual(graph.edges, [
    {
      first: '平衡',
      second: '雨天',
      lineups: [
        { slug: 'one', name: 'one' },
        { slug: 'two', name: 'two' },
      ],
    },
  ]);
});
