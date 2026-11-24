import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readLineups } from '../../src/lib/data';

type ManifestSource = {
  platform: string;
  url: string;
  title?: string;
  status: string;
  seasons?: string[];
  images?: {
    sha256?: string;
    width?: number;
    height?: number;
    file?: string;
    verified?: boolean;
  }[];
};

type Manifest = {
  run_id: string;
  created_at: string;
  sources: ManifestSource[];
};

async function main() {
  const latestRaw = await readFile(resolve('research/inbox/latest.json'), 'utf8').catch(() => null);
  if (!latestRaw) {
    console.log('暂无采集记录（未找到 research/inbox/latest.json）。请先运行 npm run research:latest。');
    return;
  }
  const { run_id } = JSON.parse(latestRaw) as { run_id: string };
  const runDir = resolve('research/inbox', run_id);
  const manifest = JSON.parse(await readFile(join(runDir, 'manifest.json'), 'utf8')) as Manifest;

  const knownShas = new Set(readLineups().flatMap((l) => l.lineup_images.map((img) => img.sha256)));
  const candidates: {
    platform: string;
    sha256: string;
    size: string;
    title: string;
    url: string;
    seasons: string[];
  }[] = [];
  const seenSha = new Set<string>();

  for (const src of manifest.sources) {
    if (src.status !== 'ok' || !src.images) continue;
    for (const img of src.images) {
      if (!img.sha256 || knownShas.has(img.sha256) || seenSha.has(img.sha256)) continue;
      seenSha.add(img.sha256);
      candidates.push({
        platform: src.platform,
        sha256: img.sha256,
        size: `${img.width ?? '?'}x${img.height ?? '?'}`,
        title: (src.title ?? '').slice(0, 60),
        url: src.url,
        seasons: src.seasons ?? [],
      });
    }
  }

  console.log(`=== 待核验候选队列 (run: ${run_id}) ===`);
  console.log(`已收录跳过: ${knownShas.size} | 本轮新候选图(去重): ${candidates.length}`);
  for (const c of candidates) {
    console.log(
      `- [${c.platform}] ${c.sha256.slice(0, 12)} (${c.size}) [${c.seasons.join(',')}] ${c.title}`,
    );
    console.log(`  来源: ${c.url}`);
  }
  if (!candidates.length) {
    console.log('本轮无新候选图需要核验。');
  } else {
    console.log(`\n下一步：运行 npm run research:vision 生成受限识图切片，核验后写入 data/lineups/ 并执行部署。`);
  }
}

await main();
