import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireResearchLock } from '../scripts/collect/lock';

function probe(lockPath: string) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      `import { acquireResearchLock } from './scripts/collect/lock.ts';
       const release = acquireResearchLock(process.argv[1]);
       console.log('acquired ' + process.pid);
       release();`,
      lockPath,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
}

test('研究锁被占用时报告持有者 PID 并失败', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roco-research-lock-'));
  const lockPath = join(dir, '.research.lock');
  const release = acquireResearchLock(lockPath);
  try {
    assert.equal(readFileSync(lockPath, 'utf8').trim(), String(process.pid));
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        `import { acquireResearchLock } from './scripts/collect/lock.ts';
         try { acquireResearchLock(process.argv[1]); }
         catch (error) {
           console.log(error instanceof Error ? error.message : String(error));
           process.exit(2);
         }`,
        lockPath,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.equal(child.status, 2, child.stderr);
    assert.match(child.stdout, new RegExp(`PID ${process.pid}`));
    assert.match(child.stdout, /本次退出/);
  } finally {
    release();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('释放研究锁后其他进程可以获取', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roco-research-lock-'));
  const lockPath = join(dir, '.research.lock');
  const release = acquireResearchLock(lockPath);
  release();
  try {
    const child = probe(lockPath);
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /acquired/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
