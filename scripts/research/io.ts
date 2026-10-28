import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

// Research run bookkeeping: the only place that JSON.parses latest.json /
// manifest.json. Every other research/validate script reads through here so a
// malformed run fails fast with a zod error instead of surfacing later as an
// undefined property access on an `any`.
//
// latest.json contract: only run_id is relied on; anything else is tolerated.
// manifest contract: run_id must be a string and sources must be an array.
// The source shape below mirrors the producer in scripts/collect/run.ts
// (SourceRecord). Only url/status are required here: coverage() needs them,
// and every other field already has its own downstream check (for example
// change-evidence rejects a source without a valid id). Unknown top-level and
// source fields pass through via looseObject instead of being invented here.
// browser_error stays nullable because the producer writes null on success;
// coverage() treats null and undefined identically (both falsy), so the one
// coverage caller normalises null to undefined at the call site.

export const latestRunSchema = z.looseObject({ run_id: z.string().min(1) });
export type LatestRun = z.infer<typeof latestRunSchema>;

export const manifestImageSchema = z.looseObject({
  url: z.string().optional(),
  context: z.string().optional(),
  method: z.string().optional(),
  order: z.number().optional(),
  sha256: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  phash: z.string().optional(),
  file: z.string().optional(),
  verified: z.boolean().optional(),
  mapping_confidence: z.string().optional(),
  error: z.string().optional(),
});
export type ManifestImage = z.infer<typeof manifestImageSchema>;

export const manifestSourceSchema = z.looseObject({
  id: z.string().optional(),
  url: z.string(),
  platform: z.string().optional(),
  enabled: z.boolean().optional(),
  seasons: z.array(z.string()).optional(),
  origin: z.string().optional(),
  pending_image_urls: z.array(z.string()).optional(),
  processed_image_urls: z.array(z.string()).optional(),
  evidence_hash: z.string().optional(),
  attempts: z.number().optional(),
  retry_after: z.string().optional(),
  status: z.string(),
  resolved_url: z.string().optional(),
  title: z.string().optional(),
  images: z.array(manifestImageSchema).optional(),
  image_nodes: z.number().optional(),
  deferred_images: z.array(z.looseObject({
    url: z.string().optional(),
    context: z.string().optional(),
    method: z.string().optional(),
    order: z.number().optional(),
  })).optional(),
  browser_error: z.string().nullable().optional(),
  checked_at: z.string().optional(),
  error: z.string().optional(),
});
export type ManifestSource = z.infer<typeof manifestSourceSchema>;

export const manifestSchema = z.looseObject({
  run_id: z.string().min(1),
  target_seasons: z.array(z.string()).optional(),
  sources: z.array(manifestSourceSchema),
  search_health: z.array(z.looseObject({
    season: z.string().optional(),
    platform: z.string().optional(),
    status: z.string(),
  })).optional(),
  deferred_sources: z.array(z.looseObject({
    pending_image_urls: z.array(z.string()).optional(),
  })).optional(),
});
export type ResearchManifest = z.infer<typeof manifestSchema>;

/** Read <inboxRoot>/latest.json and return its validated run_id. */
export async function readLatestRunId(inboxRoot = 'research/inbox'): Promise<string> {
  const raw: unknown = JSON.parse(await readFile(join(inboxRoot, 'latest.json'), 'utf8'));
  return latestRunSchema.parse(raw).run_id;
}

/** Read <runRoot>/manifest.json and return its validated contents. */
export async function readManifest(runRoot: string): Promise<ResearchManifest> {
  const raw: unknown = JSON.parse(await readFile(join(runRoot, 'manifest.json'), 'utf8'));
  return manifestSchema.parse(raw);
}

/**
 * Read the latest run's id and manifest. The caller keeps its existing
 * manifest.run_id === runId check; this helper deliberately does not add a
 * second, differently-worded mismatch error.
 */
export async function readLatestManifest(inboxRoot = 'research/inbox'): Promise<{ runId: string; manifest: ResearchManifest }> {
  const runId = await readLatestRunId(inboxRoot);
  const manifest = await readManifest(join(inboxRoot, runId));
  return { runId, manifest };
}
