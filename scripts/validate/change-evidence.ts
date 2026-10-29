import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ChangeEvidence } from '../../src/lib/refresh';
import { readManifest } from '../research/io';

// Each committed evidence JSON file is limited to 256 KiB, measured in bytes.
export const MAX_EVIDENCE_FILE_BYTES = 262144;
const runIdSchema = z.string().regex(/^[a-zA-Z0-9-]+$/);
export const receiptSchema = z.array(
  z
    .object({
      lineup_id: z.string().regex(/^[a-z0-9-]+$/),
      fields: z.array(z.string().min(1)).min(1),
      source_url: z.url(),
      artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(1),
    })
    .strict(),
);

export const committedEvidenceSchema = z
  .object({
    run_id: runIdSchema,
    sources: z.array(
      z
        .object({ url: z.url(), artifact_sha256: z.array(z.string().regex(/^[a-f0-9]{64}$/)) })
        .strict(),
    ),
  })
  .strict();

async function readEvidenceJson(path: string): Promise<unknown> {
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(MAX_EVIDENCE_FILE_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await file.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length > MAX_EVIDENCE_FILE_BYTES) throw Error(`证据文件超过 256 KiB：${path}`);
    return JSON.parse(bytes.subarray(0, length).toString('utf8'));
  } finally {
    await file.close();
  }
}

export function assertNoTrackedInbox(paths: string[]): void {
  if (paths.some((path) => path.startsWith('research/inbox/')))
    throw Error('不允许跟踪 research/inbox 文件');
}

/** Paths are repository-relative tracked paths, not directory contents. */
export async function readCommittedChangeEvidence(
  paths: string[],
  repositoryRoot = '.',
): Promise<{ evidence: ChangeEvidence[]; accessibleUrls: string[] }> {
  const evidence: ChangeEvidence[] = [];
  const accessibleUrls: string[] = [];
  const records = paths.filter((path) =>
    /^research\/runs\/[^/]+\/(changes|evidence)\.json$/.test(path),
  );
  const evidencePaths = new Set(records.filter((path) => path.endsWith('/evidence.json')));
  const sourcesByRun = new Map<string, z.infer<typeof committedEvidenceSchema>>();
  for (const path of evidencePaths) {
    const runId = path.split('/')[2];
    runIdSchema.parse(runId);
    const record = committedEvidenceSchema.parse(
      await readEvidenceJson(join(repositoryRoot, path)),
    );
    if (record.run_id !== runId) throw Error('研究运行 ID 与路径不匹配');
    sourcesByRun.set(runId, record);
    accessibleUrls.push(...record.sources.map((source) => source.url));
  }
  for (const path of records.filter((path) => path.endsWith('/changes.json'))) {
    const runId = path.split('/')[2];
    runIdSchema.parse(runId);
    const receipts = receiptSchema.parse(await readEvidenceJson(join(repositoryRoot, path)));
    const record = sourcesByRun.get(runId);
    if (!record) throw Error(`缺少已跟踪的研究证据：${runId}`);
    for (const receipt of receipts) {
      if (
        !record.sources.some(
          (source) =>
            source.url === receipt.source_url &&
            source.artifact_sha256.includes(receipt.artifact_sha256),
        )
      )
        throw Error(`变更证据来源或哈希不匹配：${receipt.lineup_id}`);
    }
    evidence.push(...receipts);
  }
  return { evidence, accessibleUrls };
}

export async function readChangeEvidence(
  runId: string,
  researchRoot = 'research',
): Promise<{ evidence: ChangeEvidence[]; accessibleUrls: string[] }> {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw Error('无效研究路径');
  const root = join(researchRoot, 'inbox', runId);
  const manifest = await readManifest(root);
  if (manifest.run_id !== runId) throw Error('研究运行 ID 不匹配');
  let raw: unknown = [];
  try {
    raw = await readEvidenceJson(join(researchRoot, 'runs', runId, 'changes.json'));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const evidence = receiptSchema.parse(raw);
  const accessibleUrls = manifest.sources.filter((s) => s.status === 'ok').map((s) => s.url);
  for (const receipt of evidence) {
    const source = manifest.sources.find((s) => s.url === receipt.source_url && s.status === 'ok');
    if (!source || !source.id || !/^[a-zA-Z0-9-]+$/.test(source.id))
      throw Error('变更证据来源未成功采集');
    const files = [
      'page.html',
      ...(source.images ?? []).flatMap((i) =>
        !i.error && i.file && /^[a-f0-9]{64}\.(png|jpe?g|webp|avif)$/.test(i.file) ? [i.file] : [],
      ),
    ];
    let matched = false;
    for (const file of files) {
      const bytes = await readFile(join(root, source.id, file));
      if (createHash('sha256').update(bytes).digest('hex') === receipt.artifact_sha256) {
        matched = true;
        break;
      }
    }
    if (!matched) throw Error(`变更证据哈希不匹配：${receipt.lineup_id}`);
  }
  return { evidence, accessibleUrls };
}
