import { mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadData } from '../../src/lib/data';
import { seasonIdSchema } from '../../src/lib/schema';
import { guardRefresh } from '../../src/lib/refresh';
import { imageInfo } from '../extract/image';
import { readChangeEvidence } from './change-evidence';
import { readLatestRunId } from '../research/io';

const sourceListSchema = z.array(z.looseObject({
  url: z.url().refine(url => new URL(url).protocol === 'https:'),
  enabled: z.boolean(), seasons: z.array(seasonIdSchema).optional(),
}));

async function optionalFile(path: string) {
  try { return await readFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

async function atomicWrite(path: string, bytes: Buffer) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = resolve(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

// Snapshot every destination before applying anything; restore touched files on failure.
export async function applyFileChanges(root: string, changes: Map<string, Buffer | null>, install = atomicWrite) {
  const prepared = [];
  for (const [path, bytes] of changes) {
    const target = resolve(root, path), rel = relative(resolve(root), target);
    if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel))
      throw Error('晋升目标越界');
    const previous = await optionalFile(target);
    if (bytes === null ? previous === null : previous?.equals(bytes)) continue;
    prepared.push({ target, bytes, previous });
  }
  const touched: typeof prepared = [];
  try {
    for (const change of prepared) {
      touched.push(change);
      if (change.bytes === null) await unlink(change.target);
      else await install(change.target, change.bytes);
    }
  } catch (error) {
    const failures: unknown[] = [];
    for (const { target, previous } of touched.reverse()) {
      try {
        if (previous === null) await rm(target, { force: true });
        else await atomicWrite(target, previous);
      } catch (failure) { failures.push(failure); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], '晋升失败，部分文件恢复失败，请检查工作区');
    throw error;
  }
}

export async function promoteContent(root = process.cwd(), staging = resolve(root, '.refresh-content')) {
  const previous = loadData(root).allLineups;
  const proposed = loadData(staging).allLineups;
  if (!proposed.length || new Set(proposed.map(l => l.id)).size !== proposed.length
    || new Set(proposed.map(l => l.slug)).size !== proposed.length) throw Error('候选数据库为空或重复');

  const changes = new Map<string, Buffer | null>();
  const stageFile = async (path: string) => {
    const bytes = await readFile(resolve(staging, path));
    changes.set(path, bytes);
    return bytes;
  };
  // Preflight the complete package, including auxiliary JSON, before any production writes.
  for (const name of ['sources.json', 'update-state.json', 'seasons.json', 'search-queries.json']) {
    const value: unknown = JSON.parse((await stageFile(`data/${name}`)).toString('utf8'));
    if (name === 'sources.json') sourceListSchema.parse(value);
    if (name === 'search-queries.json') z.array(z.string().trim().min(1)).parse(value);
  }
  const researchRoot = resolve(root, 'research');
  const run_id = await readLatestRunId(resolve(researchRoot, 'inbox'));
  const { evidence, accessibleUrls } = await readChangeEvidence(run_id, researchRoot);
  guardRefresh(previous, proposed, accessibleUrls, evidence);

  for (const lineup of proposed) {
    const folder = lineup.status === 'archived' ? 'archive' : 'lineups';
    await stageFile(`data/${folder}/${lineup.slug}.json`);
    const old = previous.find(l => l.id === lineup.id);
    if (old && (old.status === 'archived') !== (lineup.status === 'archived'))
      changes.set(`data/${old.status === 'archived' ? 'archive' : 'lineups'}/${old.slug}.json`, null);
    for (const image of lineup.lineup_images) {
      const path = `public${image.path}`;
      const bytes = changes.get(path) ?? await stageFile(path);
      const info = await imageInfo(bytes);
      for (const key of ['sha256', 'width', 'height', 'phash'] as const)
        if (info[key] !== image[key]) throw Error('候选图片与记录不一致');
    }
  }
  await applyFileChanges(root, changes);
  return proposed.length;
}
