import { writeFile, mkdir, access } from 'node:fs/promises';
import { readLineups } from '../../src/lib/data';
import { guardRefresh } from '../../src/lib/refresh';
import { execFileSync } from 'node:child_process';
import { lineupSchema } from '../../src/lib/schema';
import {
  assertNoTrackedInbox,
  assertCommittedReceipts,
  readChangeEvidence,
} from './change-evidence';
import { readLatestRunId } from '../research/io';
const current = readLineups();
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'research/inbox', 'research/runs'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
assertNoTrackedInbox(tracked);
await mkdir('research', { recursive: true });
if (process.argv.includes('--snapshot')) {
  await writeFile('research/baseline.json', JSON.stringify(current, null, 2) + '\n');
  console.log('已保存更新前快照');
} else {
  // The baseline comes from the checkout, never from model-writable artifacts.
  const baseSha = process.env.REFRESH_BASE_SHA;
  if (baseSha && !/^[a-f0-9]{40}$/.test(baseSha)) throw Error('无效基线提交');
  const ref = baseSha || 'HEAD';
  const paths = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', ref, '--', 'data/lineups', 'data/archive'],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/)
    .filter((p) => p.endsWith('.json'));
  const previous = paths.map((path) =>
    lineupSchema.parse(
      JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })),
    ),
  );
  // A clean checkout has no ignored inbox. Missing evidence must still reject
  // every content change; malformed or incomplete existing evidence stays fatal.
  let hasInbox = true;
  try {
    await access('research/inbox/latest.json');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    hasInbox = false;
  }
  let changeEvidence: Awaited<ReturnType<typeof readChangeEvidence>>;
  if (hasInbox) {
    const run_id = await readLatestRunId();
    if (!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效研究路径');
    changeEvidence = await readChangeEvidence(run_id);
  } else {
    changeEvidence = await assertCommittedReceipts(tracked, current);
  }
  const { evidence, accessibleUrls } = changeEvidence;
  guardRefresh(previous, current, accessibleUrls, evidence);
  console.log('非破坏性更新检查通过。');
}
