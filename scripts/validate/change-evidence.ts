import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ChangeEvidence } from '../../src/lib/refresh';

const receiptSchema = z.array(z.object({
  lineup_id: z.string().regex(/^[a-z0-9-]+$/),
  fields: z.array(z.string().min(1)).min(1),
  source_url: z.url(), artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(1),
}).strict());

export async function readChangeEvidence(runId: string, researchRoot = 'research'): Promise<{ evidence: ChangeEvidence[]; accessibleUrls: string[] }> {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw Error('无效研究路径');
  const root = join(researchRoot, 'inbox', runId);
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (manifest.run_id !== runId) throw Error('研究运行 ID 不匹配');
  let raw: unknown = [];
  try { raw = JSON.parse(await readFile(join(researchRoot, 'runs', runId, 'changes.json'), 'utf8')); }
  catch (e: any) { if (e.code !== 'ENOENT') throw e; }
  const evidence = receiptSchema.parse(raw);
  const accessibleUrls = manifest.sources.filter((s: any) => s.status === 'ok').map((s: any) => s.url) as string[];
  for (const receipt of evidence) {
    const source = manifest.sources.find((s: any) => s.url === receipt.source_url && s.status === 'ok');
    if (!source || !/^[a-zA-Z0-9-]+$/.test(source.id)) throw Error('变更证据来源未成功采集');
    const files = ['page.html', ...(source.images ?? []).filter((i: any) => !i.error && /^[a-f0-9]{64}\.(png|jpe?g|webp|avif)$/.test(i.file)).map((i: any) => i.file)];
    let matched = false;
    for (const file of files) {
      const bytes = await readFile(join(root, source.id, file));
      if (createHash('sha256').update(bytes).digest('hex') === receipt.artifact_sha256) { matched = true; break; }
    }
    if (!matched) throw Error(`变更证据哈希不匹配：${receipt.lineup_id}`);
  }
  return { evidence, accessibleUrls };
}
