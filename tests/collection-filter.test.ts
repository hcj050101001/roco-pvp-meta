import test from 'node:test';
import assert from 'node:assert/strict';
import type { CollectionState } from '../src/lib/collection-state';
import {
  filterCollection,
  isVisible,
  normalizeSearch,
  sortCollection,
  type CollectionCard,
} from '../src/lib/collection-filter';

const baseState: CollectionState = {
  query: '',
  type: 'all',
  season: 'all',
  video: false,
  sort: 'recommended',
  page: 1,
};

function card(overrides: Partial<CollectionCard> = {}): CollectionCard {
  return {
    search: '雨天狼王',
    types: ['雨天'],
    season: 'S2',
    video: true,
    date: '2026-10-01',
    index: 0,
    title: '雨天队',
    ...overrides,
  };
}

test('isVisible trims and lowercases query before matching', () => {
  assert.equal(
    isVisible(card({ search: 'roco 雨天狼王' }), { ...baseState, query: '  ROCO 雨天 ' }),
    true,
  );
  assert.equal(isVisible(card({ search: '雨天狼王' }), { ...baseState, query: ' 火系 ' }), false);
});

test('isVisible combines type, season, and video filters', () => {
  const candidate = card({ types: ['雨天', '速攻'], season: 'S3', video: true });
  assert.equal(
    isVisible(candidate, { ...baseState, type: '速攻', season: 'S3', video: true }),
    true,
  );
  assert.equal(isVisible(candidate, { ...baseState, type: '平衡' }), false);
  assert.equal(isVisible(candidate, { ...baseState, season: 'S2' }), false);
  assert.equal(isVisible(card({ video: false }), { ...baseState, video: true }), false);
  assert.equal(isVisible(card({ video: false }), baseState), true);
});

test('filterCollection 对已规范化的索引与逐卡筛选结果一致', () => {
  const cards = [
    card({ search: normalizeSearch('ＴＥＳＴ  雨天队'), types: ['雨天'], season: 'S4' }),
    card({ search: normalizeSearch('test 火系队'), types: ['火系'], season: 'S4' }),
    card({ search: normalizeSearch('旧赛季 雨天队'), types: ['雨天'], season: 'S3' }),
  ];
  const state = { ...baseState, query: '  TEST 雨天 ', type: '雨天', season: 'S4', video: true };
  assert.deepEqual(
    filterCollection(cards, state),
    cards.filter((item) => isVisible(item, state)),
  );
  assert.deepEqual(filterCollection(cards, state), [cards[0]]);
});

test('sortCollection applies default and recent ordering with specified ties', () => {
  const items = [
    card({ index: 2, date: '2026-10-02', title: '乙队' }),
    card({ index: 1, date: '2026-10-03', title: '丙队' }),
    card({ index: 0, date: '2026-10-03', title: '甲队' }),
    card({ index: 3, date: '2026-10-01', title: '甲队' }),
  ];

  assert.deepEqual(
    sortCollection(items, 'recommended').map((item) => item.index),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    sortCollection(items, 'recent').map((item) => item.index),
    [0, 1, 2, 3],
  );
  // 旧 sort=name 不再按名称排序，回落到默认索引顺序。
  assert.deepEqual(
    sortCollection(items, 'name').map((item) => item.index),
    [0, 1, 2, 3],
  );
});

test('sortCollection returns a new array and leaves its input order unchanged', () => {
  const items = [card({ index: 2 }), card({ index: 0 }), card({ index: 1 })];
  const originalOrder = [...items];
  const sorted = sortCollection(items, 'recommended');

  assert.notEqual(sorted, items);
  assert.deepEqual(
    sorted.map((item) => item.index),
    [0, 1, 2],
  );
  assert.deepEqual(items, originalOrder);
});
