import test from 'node:test';
import assert from 'node:assert/strict';
import { readCollectionState, writeCollectionState, safeCollectionReturn } from '../src/lib/collection-state';

const types = ['all', 'archetype', 'weather'];
const seasons = ['all', 'S4', 'S5'];

test('readCollectionState 默认值及非法筛选回落', () => {
  assert.deepEqual(readCollectionState(new URL('https://example.com/'), types, seasons), {
    query: '', type: 'all', season: 'all', video: false, sort: 'recommended',
  });
  assert.deepEqual(readCollectionState(new URL('https://example.com/?type=unknown&season=S99&sort=invalid'), types, seasons), {
    query: '', type: 'all', season: 'all', video: false, sort: 'recommended',
  });
});

test('readCollectionState 读取查询、合法筛选和 video=1', () => {
  assert.deepEqual(readCollectionState(new URL('https://example.com/?q=rain&type=weather&season=S5&sort=recent&video=1'), types, seasons), {
    query: 'rain', type: 'weather', season: 'S5', video: true, sort: 'recent',
  });
  assert.equal(readCollectionState(new URL('https://example.com/?video=true'), types, seasons).video, false);
});

test('writeCollectionState 去除查询空格并删除默认值参数', () => {
  const result = writeCollectionState(new URL('https://example.com/?q=old&type=weather&season=S5&video=1&sort=name&keep=yes'), {
    query: '  rain team  ', type: 'all', season: 'all', video: false, sort: 'recommended',
  });
  assert.equal(result.href, 'https://example.com/?q=rain+team&keep=yes');
  assert.equal(result.searchParams.has('type'), false);
  assert.equal(result.searchParams.has('season'), false);
  assert.equal(result.searchParams.has('video'), false);
  assert.equal(result.searchParams.has('sort'), false);
});

test('writeCollectionState 保留非默认值', () => {
  const result = writeCollectionState(new URL('https://example.com/'), {
    query: '  ', type: 'weather', season: 'S5', video: true, sort: 'name',
  });
  assert.equal(result.href, 'https://example.com/?type=weather&season=S5&video=1&sort=name');
});

test('safeCollectionReturn 拒绝空值、协议相对路径、外站、凭据和未允许路径', () => {
  const origin = 'https://example.com';
  const base = '/roco-pvp-meta';
  for (const value of [null, '', '//evil.example/roco-pvp-meta/', 'https://evil.example/roco-pvp-meta/',
    '//user:pass@example.com/roco-pvp-meta/', '/roco-pvp-meta/other/', '/elsewhere/']) {
    assert.equal(safeCollectionReturn(value, origin, base), null, `应拒绝 ${String(value)}`);
  }
});

test('safeCollectionReturn 只允许根路径和 /history/ 并保留查询片段', () => {
  const origin = 'https://example.com';
  const base = '/roco-pvp-meta';
  assert.equal(safeCollectionReturn('/roco-pvp-meta/?q=rain#top', origin, base), '/roco-pvp-meta/?q=rain#top');
  assert.equal(safeCollectionReturn('/roco-pvp-meta/history/?season=S4#list', origin, base), '/roco-pvp-meta/history/?season=S4#list');
  assert.equal(safeCollectionReturn('/roco-pvp-meta/history', origin, base), null);
});
