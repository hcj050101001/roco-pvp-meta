import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { allLineups, loadData } from '../src/lib/data';
import { applyFileChanges, promoteContent } from '../scripts/validate/promotion';

async function put(root: string, path: string, value: unknown) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value));
}

async function tree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const [path, hash] of Object.entries(await tree(join(root, entry.name)))) files[`${entry.name}/${path}`] = hash;
    } else files[entry.name] = createHash('sha256').update(await readFile(join(root, entry.name))).digest('hex');
  }
  return files;
}

async function cleanup(root: string) {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  assert.ok(basename(root).startsWith('roco-promote-'));
  await rm(root, { recursive: true, force: true });
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'roco-promote-'));
  const staging = join(root, '.refresh-content');
  const original = structuredClone(allLineups.find(l => l.status === 'active' && l.season === 'S4')!);
  const next = { ...structuredClone(original), summary: `${original.summary} 已核实的新描述。` };
  const unchanged = { ...structuredClone(original), id: 'unchanged-team', slug: 'unchanged-team' };
  const artifact = Buffer.from('<article>本轮核实的来源资料</article>');
  const source = original.sources[0].url;
  for (const directory of [root, staging]) {
    await put(directory, 'data/update-state.json', { season: 'S4', version_label: '测试赛季' });
    await put(directory, 'data/seasons.json', [{ id: 'S4', name: '测试赛季', intro: '测试简介' }]);
    await put(directory, 'data/sources.json', [{ url: source, enabled: true }]);
    await put(directory, 'data/search-queries.json', ['测试配队']);
    await put(directory, `data/lineups/${original.slug}.json`, directory === root ? original : next);
    await put(directory, `data/lineups/${unchanged.slug}.json`, unchanged);
    for (const image of original.lineup_images) {
      const target = join(directory, 'public', image.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(resolve(`public${image.path}`)));
    }
  }
  await put(root, 'research/inbox/latest.json', { run_id: 'test-run' });
  await put(root, 'research/inbox/test-run/manifest.json', {
    run_id: 'test-run', sources: [{ id: 'source-1', url: source, status: 'ok', images: [] }],
  });
  await mkdir(join(root, 'research/inbox/test-run/source-1'), { recursive: true });
  await writeFile(join(root, 'research/inbox/test-run/source-1/page.html'), artifact);
  const receipt = { lineup_id: original.id, fields: ['summary'], source_url: source,
    artifact_sha256: createHash('sha256').update(artifact).digest('hex'), reason: '核实新的来源描述' };
  await put(root, 'research/runs/test-run/changes.json', [receipt]);
  return { root, staging, original, next, receipt };
}

test('晋升在辅助文件缺失、格式错误、图片损坏或证据缺失时不改生产文件', async () => {
  for (const failure of ['missing', 'invalid', 'image', 'evidence', 'roster']) {
    const { root, staging, original, next } = await fixture();
    try {
      const beforeData = await tree(join(root, 'data')), beforeImages = await tree(join(root, 'public'));
      if (failure === 'missing') await rm(join(staging, 'data/search-queries.json'));
      if (failure === 'invalid') await put(staging, 'data/sources.json', [{ url: original.sources[0].url, enabled: 'yes' }]);
      if (failure === 'image') await writeFile(join(staging, 'public', original.lineup_images[0].path), 'broken image');
      if (failure === 'evidence') await put(root, 'research/runs/test-run/changes.json', []);
      if (failure === 'roster') {
        next.roster[0].name = '未经核实的名称';
        await put(staging, `data/lineups/${next.slug}.json`, next);
      }
      await assert.rejects(promoteContent(root, staging));
      assert.deepEqual(await tree(join(root, 'data')), beforeData, failure);
      assert.deepEqual(await tree(join(root, 'public')), beforeImages, failure);
    } finally { await cleanup(root); }
  }
});

test('完整候选及哈希证据通过后应用更新，原图保持不变', async () => {
  const { root, staging, original, next } = await fixture();
  try {
    const images = await tree(join(root, 'public'));
    assert.equal(await promoteContent(root, staging), 2);
    assert.equal(loadData(root).allLineups.find(l => l.id === original.id)?.summary, next.summary);
    assert.deepEqual(await tree(join(root, 'public')), images);
  } finally { await cleanup(root); }
});

test('归档晋升移动 JSON 并保留原图，守卫要求对应字段证据', async () => {
  const { root, staging, original, next, receipt } = await fixture();
  try {
    await rm(join(staging, `data/lineups/${next.slug}.json`));
    await put(staging, `data/archive/${next.slug}.json`, { ...next, status: 'archived', archive_reason: '该历史配置已归档' });
    await put(root, 'research/runs/test-run/changes.json', [{ ...receipt, fields: ['summary', 'status', 'archive_reason'] }]);
    const images = await tree(join(root, 'public'));
    await promoteContent(root, staging);
    await assert.rejects(readFile(join(root, `data/lineups/${original.slug}.json`)), { code: 'ENOENT' });
    assert.equal(loadData(root).allLineups.find(l => l.id === original.id)?.status, 'archived');
    assert.deepEqual(await tree(join(root, 'public')), images);
  } finally { await cleanup(root); }
});

test('写入中途失败恢复覆盖、删除及新建文件，拒绝越界目标', async () => {
  const root = await mkdtemp(join(tmpdir(), 'roco-promote-'));
  try {
    await put(root, 'existing.json', { old: true });
    await put(root, 'removed.json', { keep: true });
    const before = await tree(root);
    let writes = 0;
    await assert.rejects(applyFileChanges(root, new Map([
      ['existing.json', Buffer.from('updated')], ['removed.json', null],
      ['new.json', Buffer.from('new')], ['failure.json', Buffer.from('partial')],
    ]), async (path, bytes) => {
      await writeFile(path, bytes);
      if (++writes === 3) throw Error('模拟磁盘写入失败');
    }), /模拟磁盘写入失败/);
    assert.deepEqual(await tree(root), before);
    await assert.rejects(applyFileChanges(root, new Map([['../escape.json', Buffer.from('invalid')]])), /越界/);
  } finally { await cleanup(root); }
});
