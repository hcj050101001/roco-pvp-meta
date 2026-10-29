import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allLineups } from '../src/lib/data';
import { lineupSchema } from '../src/lib/schema';
import { guardRefresh } from '../src/lib/refresh';
import {
  assertNoTrackedInbox,
  MAX_EVIDENCE_FILE_BYTES,
  readCommittedChangeEvidence,
} from '../scripts/validate/change-evidence';

const run = 'run-1';
const changesPath = `research/runs/${run}/changes.json`;
const evidencePath = `research/runs/${run}/evidence.json`;
const sha = 'a'.repeat(64);
const lineup = structuredClone(allLineups[0]);
const url = lineup.sources[0].url;
const receipt = {
  lineup_id: lineup.id,
  fields: Object.keys(lineup).filter(
    (field) => !['last_verified_at', 'verification_notes'].includes(field),
  ),
  source_url: url,
  artifact_sha256: sha,
  reason: '已核对配置',
};
const record = { run_id: run, sources: [{ url, artifact_sha256: [sha] }] };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'roco-committed-evidence-'));
  await mkdir(join(root, 'research/runs', run), { recursive: true });
  const put = (path: string, value: unknown) => writeFile(join(root, path), JSON.stringify(value));
  await put(changesPath, [receipt]);
  await put(evidencePath, record);
  return { root, put, paths: [changesPath, evidencePath] };
}

async function withFixture(fn: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const f = await fixture();
  try {
    await fn(f);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
}

test('完整离线证据可用于新增已校验的阵容', async () => {
  await withFixture(async ({ root, paths }) => {
    const { evidence, accessibleUrls } = await readCommittedChangeEvidence(paths, root);
    assert.doesNotThrow(() =>
      guardRefresh([], [lineupSchema.parse(lineup)], accessibleUrls, evidence),
    );
    assert.throws(() => lineupSchema.parse({ ...lineup, lineup_images: [] }));
  });
});

test('缺少同轮证据、来源或哈希时拒绝', async () => {
  await withFixture(async ({ root, put, paths }) => {
    await assert.rejects(readCommittedChangeEvidence([changesPath], root), /缺少已跟踪/);
    await rm(join(root, evidencePath));
    await assert.rejects(readCommittedChangeEvidence(paths, root), /ENOENT/);
    for (const sources of [
      [{ url, artifact_sha256: ['b'.repeat(64)] }],
      [{ url: 'https://example.com/other', artifact_sha256: [sha] }],
    ]) {
      await put(evidencePath, { run_id: run, sources });
      await assert.rejects(readCommittedChangeEvidence(paths, root), /来源或哈希不匹配/);
    }
    await put(evidencePath, record);
    const other = {
      ...lineup,
      sources: [{ ...lineup.sources[0], url: 'https://example.com/other' }],
    };
    const { evidence, accessibleUrls } = await readCommittedChangeEvidence(paths, root);
    assert.throws(() => guardRefresh([], [other], accessibleUrls, evidence), /来源均失败/);
  });
});

test('缺少 player_notes 字段证据时拒绝', async () => {
  await withFixture(async ({ root, put, paths }) => {
    await put(changesPath, [
      { ...receipt, fields: receipt.fields.filter((field) => field !== 'player_notes') },
    ]);
    const { evidence, accessibleUrls } = await readCommittedChangeEvidence(paths, root);
    assert.throws(() => guardRefresh([], [lineup], accessibleUrls, evidence), /player_notes/);
  });
});

test('回执与证据均执行大小限制', async () => {
  for (const path of [changesPath, evidencePath]) {
    await withFixture(async ({ root, paths }) => {
      await writeFile(join(root, path), ' '.repeat(MAX_EVIDENCE_FILE_BYTES + 1));
      await assert.rejects(readCommittedChangeEvidence(paths, root), /超过 256 KiB/);
    });
  }
});

test('严格校验格式、哈希和目录中的运行 ID', async () => {
  await withFixture(async ({ root, put, paths }) => {
    for (const invalid of [
      { ...record, extra: true },
      { ...record, run_id: 'other' },
      { ...record, sources: [{ url, artifact_sha256: [sha.toUpperCase()] }] },
      { ...record, sources: [{ url, artifact_sha256: [sha], status: 'ok' }] },
    ]) {
      await put(evidencePath, invalid);
      await assert.rejects(readCommittedChangeEvidence(paths, root));
    }
    await put(evidencePath, record);
    await put(changesPath, [{ ...receipt, extra: true }]);
    await assert.rejects(readCommittedChangeEvidence(paths, root));
    await assert.rejects(
      readCommittedChangeEvidence(['research/runs/invalid_id/changes.json'], root),
    );
  });
});

test('检测已跟踪 inbox 路径', () => {
  assert.doesNotThrow(() => assertNoTrackedInbox(['research/runs/run-1/evidence.json']));
  assert.throws(() => assertNoTrackedInbox(['research/inbox/run-1/page.html']), /不允许跟踪/);
});
