import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { readLatestRunId, readManifest, readLatestManifest } from '../scripts/research/io';

async function inboxWith(latest: unknown, manifest: unknown, runId = 'run-1') {
  const root = await mkdtemp(join(tmpdir(), 'roco-io-'));
  const inbox = join(root, 'inbox');
  await mkdir(join(inbox, runId), { recursive: true });
  await writeFile(join(inbox, 'latest.json'), JSON.stringify(latest));
  if (manifest !== undefined) await writeFile(join(inbox, runId, 'manifest.json'), JSON.stringify(manifest));
  return { root, inbox, runId };
}

const validManifest = {
  run_id: 'run-1',
  note: 'unknown top-level fields are tolerated',
  sources: [
    { id: 's1', url: 'https://example.com/page', status: 'ok', images: [{ sha256: 'a'.repeat(64), file: 'a.jpg' }] },
    { url: 'https://example.com/failed', status: 'source_fetch_failed', browser_error: null },
  ],
};

test('readLatestRunId 返回 latest.json 中的 run_id', async () => {
  const { inbox } = await inboxWith({ run_id: 'run-9' }, undefined);
  assert.equal(await readLatestRunId(inbox), 'run-9');
});

test('run_id 缺失或为空时报错', async () => {
  for (const latest of [{}, { run_id: '' }, { run_id: 42 }]) {
    const { inbox } = await inboxWith(latest, undefined);
    await assert.rejects(() => readLatestRunId(inbox), (e: unknown) => e instanceof z.ZodError);
  }
});

test('readManifest 校验 run_id 与 sources，并容忍未知字段', async () => {
  const { inbox, runId } = await inboxWith({ run_id: 'run-1' }, validManifest);
  const manifest = await readManifest(join(inbox, runId));
  assert.equal(manifest.run_id, 'run-1');
  assert.equal(manifest.sources.length, 2);
  assert.equal(manifest.sources[0].url, 'https://example.com/page');
  assert.equal(manifest.sources[1].browser_error, null);
  assert.equal((manifest as Record<string, unknown>).note, 'unknown top-level fields are tolerated');
});

test('manifest 非法时报错：run_id 缺失、sources 非数组、来源缺 url', async () => {
  const cases = [
    { sources: [] },
    { run_id: 'run-1', sources: { url: 'https://example.com/x' } },
    { run_id: 'run-1', sources: 'nope' },
    { run_id: 'run-1', sources: [{ status: 'ok' }] },
  ];
  for (const manifest of cases) {
    const { inbox, runId } = await inboxWith({ run_id: 'run-1' }, manifest);
    await assert.rejects(() => readManifest(join(inbox, runId)), (e: unknown) => e instanceof z.ZodError);
  }
});

test('readLatestManifest 返回 latest 的 run_id 与对应 manifest', async () => {
  const { inbox } = await inboxWith({ run_id: 'run-1' }, validManifest);
  const { runId, manifest } = await readLatestManifest(inbox);
  assert.equal(runId, 'run-1');
  assert.equal(manifest.run_id, 'run-1');
  assert.equal(manifest.sources.length, 2);
});
