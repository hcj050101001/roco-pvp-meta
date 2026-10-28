import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const decisionSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['rejected', 'pending', 'verified']),
  reason: z.string().trim().min(1),
});
const entrySchema = decisionSchema.extend({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  references: z.array(z.url()),
  checked_at: z.iso.datetime(),
  retry_after: z.iso.datetime().nullable(),
});
export type Ledger = Record<string, z.infer<typeof entrySchema>>;
export function parseLedger(raw: unknown): Ledger {
  const ledger = z.record(z.string().regex(/^[a-f0-9]{64}$/), entrySchema).parse(raw);
  for (const [hash, entry] of Object.entries(ledger))
    if (hash !== entry.sha256) throw Error('候选索引 SHA 不一致');
  return ledger;
}
export async function readLedger(path: string): Promise<Ledger> {
  try {
    return parseLedger(JSON.parse(await readFile(path, 'utf8')));
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: unknown }).code === 'ENOENT'
    )
      return {};
    throw e;
  }
}
export function fingerprint(evidence: string[]) {
  return createHash('sha256')
    .update(JSON.stringify([...new Set(evidence)].sort()))
    .digest('hex');
}
export function candidateAction(
  hash: string,
  evidenceFingerprint: string,
  ledger: Ledger,
  published: Set<string>,
  now = Date.now(),
) {
  if (published.has(hash)) return 'published' as const;
  const prior = ledger[hash];
  if (
    prior?.fingerprint === evidenceFingerprint &&
    (!prior.retry_after || Date.parse(prior.retry_after) > now)
  )
    return 'reuse' as const;
  return 'review' as const;
}
export function recordDecisions(
  ledger: Ledger,
  candidates: {
    sha256: string;
    fingerprint: string;
    references: string[];
    action: string;
    error?: string;
  }[],
  raw: unknown,
  now = new Date(),
) {
  const decisions = z.array(decisionSchema).parse(raw);
  if (new Set(decisions.map((d) => d.sha256)).size !== decisions.length)
    throw Error('候选决定重复');
  for (const d of decisions)
    if (!candidates.some((c) => c.sha256 === d.sha256 && c.action === 'review'))
      throw Error('决定不属于本轮待核验候选');
  const next = structuredClone(ledger);
  for (const c of candidates.filter((c) => c.action === 'review')) {
    const d = decisions.find((d) => d.sha256 === c.sha256);
    if (!d) throw Error(`候选未记录决定：${c.sha256}`);
    if (c.error && d.status !== 'pending') throw Error('预览失败的候选只能待续查');
    next[c.sha256] = {
      ...d,
      fingerprint: c.fingerprint,
      references: c.references,
      checked_at: now.toISOString(),
      retry_after:
        d.status === 'pending' ? new Date(now.getTime() + 14 * 86400000).toISOString() : null,
    };
  }
  return next;
}
