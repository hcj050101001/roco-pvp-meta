import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  isVisible,
  normalizeSearch,
  PAGE_SIZE,
  type CollectionCard,
} from '../src/lib/collection-filter';

test('500 条仅测试用索引样例：规范化搜索耗时受控，首屏卡片数保持固定', () => {
  const sample: CollectionCard[] = Array.from({ length: 500 }, (_, index) => ({
    search: normalizeSearch(`Test Hero ${index} 精灵${index % 17} 雨天体系`),
    types: ['雨天体系'],
    season: `S${1 + (index % 5)}`,
    video: index % 3 === 0,
    date: `2026-10-${String(1 + (index % 28)).padStart(2, '0')}`,
    index,
    title: `Test Hero ${index}`,
  }));
  const state = {
    query: '  ＴＥＳＴ   ＨＥＲＯ 3 ',
    type: 'all',
    season: 'all',
    video: false,
    sort: 'recommended',
    page: 1,
  };
  const started = performance.now();
  const matching = sample.filter((card) => isVisible(card, state));
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 50, `500 条搜索应小于 50ms，实测 ${elapsedMs.toFixed(2)}ms`);
  assert.ok(matching.length > 0);
  assert.equal(Math.min(sample.length, PAGE_SIZE), 24);
  assert.equal(sample.length, 500);
});
