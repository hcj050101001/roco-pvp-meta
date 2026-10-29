import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hashDistance } from '../extract/image';
import { manifestSchema, readLatestManifest } from '../research/io';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
// Raw inbox artifacts are intentionally untracked. In a clean checkout, replay
// the committed evaluations through the same manifest and duplicate checks.
let hasInbox = true;
try {
  await access('research/inbox/latest.json');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  hasInbox = false;
}
const runs = [];
if (hasInbox) runs.push(await readLatestManifest('research/inbox'));
else {
  const paths = execFileSync('git', ['ls-files', 'research/runs/*/evaluation.json'], {
    encoding: 'utf8',
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (!paths.length) throw Error('缺少可校验的研究记录');
  const evaluationSchema = z.object({
    run_id: z.string().regex(/^[a-zA-Z0-9-]+$/),
    candidates: z.array(z.looseObject({ source: z.string(), sha256: z.string() })),
    source_failures: manifestSchema.shape.sources,
  });
  for (const path of paths) {
    const evaluation = evaluationSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    if (path !== `research/runs/${evaluation.run_id}/evaluation.json`)
      throw Error('研究运行 ID 与路径不匹配');
    const manifest = manifestSchema.parse({
      run_id: evaluation.run_id,
      sources: [
        ...evaluation.candidates.map(({ source, ...image }) => ({
          url: source,
          status: 'ok',
          images: [image],
        })),
        // Their images are already present in candidates; do not count twice.
        ...evaluation.source_failures.map((source) => ({ ...source, images: [] })),
      ],
    });
    runs.push({ runId: evaluation.run_id, manifest });
  }
}
for (const { runId: run_id, manifest } of runs) {
  if (!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效 run_id');
  const images = manifest.sources.flatMap((s) =>
    (s.images ?? []).filter((i) => i.sha256).map((i) => ({ ...i, source: s.url })),
  );
  const duplicates = [];
  for (let i = 0; i < images.length; i++)
    for (let j = 0; j < i; j++)
      if (
        images[i].sha256 === images[j].sha256 ||
        hashDistance(images[i].phash ?? '', images[j].phash ?? '') <= 5
      )
        duplicates.push({
          a: images[i].url,
          b: images[j].url,
          exact: images[i].sha256 === images[j].sha256,
        });
  if (hasInbox) {
    await mkdir(join('research/runs', run_id), { recursive: true });
    await writeFile(
      join('research/runs', run_id, 'evaluation.json'),
      JSON.stringify(
        {
          run_id,
          candidates: images,
          duplicates,
          source_failures: manifest.sources.filter((s) => s.status !== 'ok'),
          note: '图像语义、版本与六只成员必须视觉复核；此脚本不自动晋升生产。',
        },
        null,
        2,
      ) + '\n',
    );
  }
  console.log(`候选 ${images.length} 张，重复对 ${duplicates.length}，等待证据判断。`);
}
