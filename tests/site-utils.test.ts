import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from '../src/lib/seo';
import { normalizeBase } from '../src/lib/site';

test('serializeJsonLd 转义 < 和 &，且结果仍是合法 JSON', () => {
  const input = { text: '普通文本 <script> & 仍保留' };
  const serialized = serializeJsonLd(input);

  assert.equal(serialized, '{"text":"普通文本 \\u003cscript> \\u0026 仍保留"}');
  assert.deepEqual(JSON.parse(serialized), input);
  assert.equal(serializeJsonLd({ text: '普通文本' }), '{"text":"普通文本"}');
});

test('normalizeBase 统一空值、空格与首尾及多余斜杠', () => {
  assert.equal(normalizeBase(''), '');
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase('  '), '');
  assert.equal(normalizeBase('/roco-pvp-meta/'), '/roco-pvp-meta');
  assert.equal(normalizeBase('  /roco-pvp-meta/  '), '/roco-pvp-meta');
  assert.equal(normalizeBase('///roco-pvp-meta///'), '/roco-pvp-meta');
});
