import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate, PAGE_SIZE } from '../src/lib/collection-filter';
import { clampPage, readCollectionState, writeCollectionState } from '../src/lib/collection-state';
import { additionalStaticPages, staticPageCount, staticPagePath } from '../src/lib/static-pages';

const items = Array.from({ length: 50 }, (_, i) => i + 1);

test('PAGE_SIZE 为 24', () => {
  assert.equal(PAGE_SIZE, 24);
});

test('paginate 切片、总页数与总数', () => {
  assert.deepEqual(paginate(items, 1), {
    items: items.slice(0, 24),
    page: 1,
    totalPages: 3,
    total: 50,
  });
  assert.deepEqual(paginate(items, 2).items, items.slice(24, 48));
  assert.deepEqual(paginate(items, 3).items, items.slice(48, 50));
  assert.equal(paginate(items, 3).totalPages, 3);
});

test('paginate 页码钳制：小于 1 回落到 1，超出总页数钳制到最后一页', () => {
  assert.equal(paginate(items, 0).page, 1);
  assert.equal(paginate(items, -5).page, 1);
  assert.equal(paginate(items, 99).page, 3);
  assert.deepEqual(paginate(items, 99).items, items.slice(48, 50));
  assert.equal(paginate(items, 2.7).page, 2);
});

test('paginate 空结果仍为 1 页且无条目', () => {
  assert.deepEqual(paginate([], 1), { items: [], page: 1, totalPages: 1, total: 0 });
  assert.equal(paginate([], 99).page, 1);
});

test('paginate 不修改输入数组', () => {
  const before = [...items];
  paginate(items, 2);
  assert.deepEqual(items, before);
});

test('静态分页路径从同一 24 张切片产生，首页与往期都可逐页覆盖', () => {
  assert.equal(staticPageCount(24), 1);
  assert.equal(staticPageCount(50), 3);
  assert.deepEqual(additionalStaticPages(50), [2, 3]);
  assert.deepEqual(
    [1, ...additionalStaticPages(items.length)].flatMap((p) => paginate(items, p).items),
    items,
  );
  assert.equal(staticPagePath(1), '/');
  assert.equal(staticPagePath(2), '/page/2/');
  assert.equal(staticPagePath(3, true), '/history/page/3/');
});

test('clampPage：非法值回落、超出总页数钳制、总页数未知时不钳制上界', () => {
  assert.equal(clampPage(Number('abc')), 1);
  assert.equal(clampPage(0), 1);
  assert.equal(clampPage(-2), 1);
  assert.equal(clampPage(2.9), 2);
  assert.equal(clampPage(9, 3), 3);
  assert.equal(clampPage(9), 9);
  assert.equal(clampPage(2, 0), 1);
});

test('readCollectionState：page 默认 1，非法值回落，带总页数时钳制', () => {
  assert.equal(readCollectionState(new URL('https://example.com/'), [], []).page, 1);
  assert.equal(readCollectionState(new URL('https://example.com/?page=abc'), [], []).page, 1);
  assert.equal(readCollectionState(new URL('https://example.com/?page=0'), [], []).page, 1);
  assert.equal(readCollectionState(new URL('https://example.com/?page=2.5'), [], []).page, 2);
  assert.equal(readCollectionState(new URL('https://example.com/?page=4'), [], []).page, 4);
  assert.equal(readCollectionState(new URL('https://example.com/?page=4'), [], [], 3).page, 3);
});

test('writeCollectionState：page=1 时省略参数，page>1 时保留且不丢其他参数', () => {
  const base = {
    query: '',
    type: 'all',
    season: 'all',
    video: false,
    sort: 'recommended',
    page: 1,
  } as const;
  const first = writeCollectionState(new URL('https://example.com/?page=2&ref=guide'), {
    ...base,
    page: 1,
  });
  assert.equal(first.searchParams.has('page'), false);
  assert.equal(first.searchParams.get('ref'), 'guide');
  const third = writeCollectionState(new URL('https://example.com/?ref=guide'), {
    ...base,
    page: 3,
  });
  assert.equal(third.searchParams.get('page'), '3');
  assert.equal(third.searchParams.get('ref'), 'guide');
  // 往返：写出的 page 能原样读回。
  assert.equal(readCollectionState(third, [], []).page, 3);
});
