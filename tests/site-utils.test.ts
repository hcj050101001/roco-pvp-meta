import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/lib/escape-html';
import { serializeJsonLd } from '../src/lib/seo';
import {
  normalizeBase,
  parseRepository,
  projectBasePath,
  projectBasePathFor,
  owner,
  repoName,
} from '../src/lib/site';

test('escapeHtml 转义 & < > " 和单引号', () => {
  assert.equal(
    escapeHtml(`<img alt="a&b" title='x'>`),
    '&lt;img alt=&quot;a&amp;b&quot; title=&#39;x&#39;&gt;',
  );
  assert.equal(escapeHtml('&#39;'), '&amp;#39;');
});

test('serializeJsonLd 转义 < 和 &，且结果仍是合法 JSON', () => {
  const input = { text: '普通文本 <script> & 仍保留' };
  const serialized = serializeJsonLd(input);

  assert.equal(serialized, '{"text":"普通文本 \\u003cscript> \\u0026 仍保留"}');
  assert.deepEqual(JSON.parse(serialized), input);
  assert.equal(serializeJsonLd({ text: '普通文本' }), '{"text":"普通文本"}');
});

test('parseRepository 默认仓库兜底、显式仓库解析与非法仓库拒绝', () => {
  assert.deepEqual(parseRepository(undefined), {
    repository: 'hcj050101001/roco-pvp-meta',
    owner: 'hcj050101001',
    repoName: 'roco-pvp-meta',
  });
  assert.deepEqual(parseRepository('someone/other-repo'), {
    repository: 'someone/other-repo',
    owner: 'someone',
    repoName: 'other-repo',
  });
  assert.throws(() => parseRepository('not-a-repo'), /无效仓库名/);
  assert.throws(() => parseRepository('a/b/c'), /无效仓库名/);
});

test('projectBasePathFor 项目页带仓库子路径，用户页仓库无子路径', () => {
  assert.equal(projectBasePathFor('hcj050101001', 'roco-pvp-meta'), '/roco-pvp-meta');
  assert.equal(projectBasePathFor('someone', 'someone.github.io'), '');
  // 模块级导出与纯函数推导一致（当前进程默认仓库下应为 /roco-pvp-meta）。
  assert.equal(projectBasePath, projectBasePathFor(owner, repoName));
  assert.equal(projectBasePath, '/roco-pvp-meta');
});

test('normalizeBase 统一空值、空格与首尾及多余斜杠', () => {
  assert.equal(normalizeBase(''), '');
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase('  '), '');
  assert.equal(normalizeBase('/roco-pvp-meta/'), '/roco-pvp-meta');
  assert.equal(normalizeBase('  /roco-pvp-meta/  '), '/roco-pvp-meta');
  assert.equal(normalizeBase('///roco-pvp-meta///'), '/roco-pvp-meta');
});

test('withBase 在站点根及子路径下等价处理带或不带斜杠的路径', async () => {
  const { withBase } = await import('../src/lib/urls');
  for (const base of ['', '/']) {
    assert.equal(withBase('/history/', base), '/history/');
    assert.equal(withBase('history/', base), '/history/');
    assert.equal(withBase('/', base), '/');
  }
  for (const base of ['/roco-pvp-meta', '/roco-pvp-meta/']) {
    assert.equal(withBase('/history/', base), '/roco-pvp-meta/history/');
    assert.equal(withBase('history/', base), '/roco-pvp-meta/history/');
    assert.equal(withBase('/', base), '/roco-pvp-meta/');
    assert.equal(withBase('/assets/image.webp', base), '/roco-pvp-meta/assets/image.webp');
  }
});
