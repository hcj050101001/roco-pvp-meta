import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allLineups } from '../src/lib/data';
import { lineupSchema } from '../src/lib/schema';
import { guardRefresh } from '../src/lib/refresh';
import {
  assertNoTrackedInbox,
  assertCommittedReceipts,
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

async function gitFixture(fn: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  await withFixture(async (f) => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: f.root, stdio: 'pipe' });
    git('init', '-q');
    git('add', 'research/runs');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline');
    await fn(f);
  });
}

function amendBaseline(root: string, ...paths: string[]) {
  execFileSync('git', ['add', ...paths], { cwd: root, stdio: 'pipe' });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--amend',
      '-qm',
      'baseline',
    ],
    { cwd: root, stdio: 'pipe' },
  );
}

test('已提交回执只能追加，基线文件不得删除', async () => {
  await gitFixture(async ({ root, put, paths }) => {
    await assert.doesNotReject(assertCommittedReceipts(paths, [lineup], root));
    await put(changesPath, [receipt, { ...receipt, reason: '补充证据' }]);
    await assert.doesNotReject(assertCommittedReceipts(paths, [lineup], root));
    await put(changesPath, []);
    await assert.rejects(
      assertCommittedReceipts(paths, [lineup], root),
      /不允许删除或改写已提交的变更回执/,
    );
    await put(changesPath, [{ ...receipt, reason: '改写' }]);
    await assert.rejects(
      assertCommittedReceipts(paths, [lineup], root),
      /不允许删除或改写已提交的变更回执/,
    );
    await put(changesPath, [receipt]);
    await rm(join(root, evidencePath));
    await assert.rejects(
      assertCommittedReceipts(paths, [lineup], root),
      /不允许删除或改写已提交的变更回执/,
    );
    await assert.rejects(
      assertCommittedReceipts([changesPath], [lineup], root),
      /不允许删除或改写已提交的变更回执/,
    );
    await assert.rejects(
      assertCommittedReceipts([evidencePath], [lineup], root),
      /不允许删除或改写已提交的变更回执/,
    );
    await assert.rejects(assertCommittedReceipts(paths, [lineup], root, 'HEAD'), /无效基线提交/);
  });
});

test('已提交证据的来源和哈希只能追加', async () => {
  await gitFixture(async ({ root, put, paths }) => {
    const unreferenced = 'b'.repeat(64);
    const otherUrl = 'https://example.com/other';
    const baseline = {
      run_id: run,
      sources: [
        { url, artifact_sha256: [sha, unreferenced] },
        { url: otherUrl, artifact_sha256: [] },
      ],
    };
    await put(evidencePath, baseline);
    amendBaseline(root, evidencePath);
    for (const sources of [
      [{ url, artifact_sha256: [sha, '0'.repeat(64)] }, baseline.sources[1]],
      [{ url, artifact_sha256: ['0'.repeat(64), unreferenced] }, baseline.sources[1]],
      [baseline.sources[0]],
    ]) {
      await put(evidencePath, { run_id: run, sources });
      await assert.rejects(
        assertCommittedReceipts(paths, [lineup], root),
        /不允许删除或改写已提交的证据/,
      );
    }
    await put(evidencePath, { ...baseline, run_id: 'run-2' });
    await assert.rejects(
      assertCommittedReceipts(paths, [lineup], root),
      /不允许删除或改写已提交的证据/,
    );
    await put(evidencePath, {
      run_id: run,
      sources: [
        { url, artifact_sha256: [sha, unreferenced, 'c'.repeat(64)] },
        baseline.sources[1],
        { url: 'https://example.com/new', artifact_sha256: ['d'.repeat(64)] },
      ],
    });
    await assert.doesNotReject(assertCommittedReceipts(paths, [lineup], root, ''));
  });
});

test('基线证据也须符合严格格式和大小限制', async () => {
  for (const [baseline, error] of [
    [JSON.stringify({ ...record, extra: true }), /extra/],
    [' '.repeat(MAX_EVIDENCE_FILE_BYTES + 1), /超过 256 KiB/],
  ] as const) {
    await gitFixture(async ({ root, put, paths }) => {
      await writeFile(join(root, evidencePath), baseline);
      amendBaseline(root, evidencePath);
      await put(evidencePath, record);
      await assert.rejects(assertCommittedReceipts(paths, [lineup], root), error);
    });
  }
});

test('两个入口以空基线变量使用 HEAD，并拒绝改写未引用的证据', async () => {
  await gitFixture(async ({ root, put }) => {
    await cp('data', join(root, 'data'), { recursive: true });
    const unreferenced = 'b'.repeat(64);
    await put(evidencePath, {
      run_id: run,
      sources: [{ url, artifact_sha256: [sha, unreferenced] }],
    });
    await put(`research/runs/${run}/evaluation.json`, {
      run_id: run,
      candidates: [],
      source_failures: [],
    });
    amendBaseline(root, 'research/runs', 'data');
    for (const script of ['research.ts', 'refresh-guard.ts']) {
      const invoke = () =>
        spawnSync(
          process.execPath,
          [
            '--import',
            join(process.cwd(), 'node_modules/tsx/dist/loader.mjs'),
            join(process.cwd(), 'scripts/validate', script),
          ],
          { cwd: root, encoding: 'utf8', env: { ...process.env, REFRESH_BASE_SHA: '' } },
        );
      const valid = invoke();
      assert.equal(valid.status, 0, valid.stderr);
      await put(evidencePath, {
        run_id: run,
        sources: [{ url, artifact_sha256: [sha, '0'.repeat(64)] }],
      });
      const changed = invoke();
      assert.notEqual(changed.status, 0);
      assert.match(changed.stderr, /不允许删除或改写已提交的证据/);
      await put(evidencePath, {
        run_id: run,
        sources: [{ url, artifact_sha256: [sha, unreferenced] }],
      });
    }
  });
});

test('追加的回执必须符合严格格式并匹配阵容及来源', async () => {
  await gitFixture(async ({ root, put, paths }) => {
    for (const invalid of [
      { ...receipt, extra: true },
      { ...receipt, artifact_sha256: 'z'.repeat(64) },
    ]) {
      await put(changesPath, [receipt, invalid]);
      await assert.rejects(assertCommittedReceipts(paths, [lineup], root));
    }
    await put(changesPath, [receipt, { ...receipt, lineup_id: 'missing' }]);
    await assert.rejects(assertCommittedReceipts(paths, [lineup], root), /阵容不存在/);
    const otherUrl = 'https://example.com/other';
    await put(evidencePath, {
      run_id: run,
      sources: [...record.sources, { url: otherUrl, artifact_sha256: [sha] }],
    });
    await put(changesPath, [receipt, { ...receipt, source_url: otherUrl }]);
    await assert.rejects(assertCommittedReceipts(paths, [lineup], root), /来源不在阵容中/);
  });
});

test('两个入口在 inbox 存在时也拒绝已跟踪的 latest.json', async () => {
  await gitFixture(async ({ root }) => {
    await cp('data', join(root, 'data'), { recursive: true });
    await mkdir(join(root, 'research/inbox'), { recursive: true });
    await writeFile(join(root, 'research/inbox/latest.json'), '{}');
    execFileSync('git', ['add', '-f', 'research/inbox/latest.json'], { cwd: root });
    for (const script of ['research.ts', 'refresh-guard.ts']) {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          join(process.cwd(), 'node_modules/tsx/dist/loader.mjs'),
          join(process.cwd(), 'scripts/validate', script),
        ],
        {
          cwd: root,
          encoding: 'utf8',
        },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /不允许跟踪 research\/inbox 文件/);
    }
  });
});
