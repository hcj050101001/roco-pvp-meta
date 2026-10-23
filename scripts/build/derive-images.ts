import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLineups } from '../../src/lib/data';

const widths = [480, 800];
const root = process.cwd();
const output = resolve(root, 'public/assets/lineups/derived');
await mkdir(output, { recursive: true });

const seen = new Set<string>();
let generated = 0, reused = 0, skipped = 0;
for (const image of readLineups(root).flatMap(lineup => lineup.lineup_images)) {
  if (seen.has(image.sha256)) continue;
  seen.add(image.sha256);
  const source = resolve(root, `public${image.path}`);
  if (!existsSync(source)) throw Error(`原图不存在: ${image.path}`);
  const sourceSize = (await stat(source)).size;
  for (const width of widths) {
    if (image.width <= width) continue;
    const target = resolve(output, `${image.sha256}-${width}.webp`);
    if (existsSync(target)) {
      if ((await stat(target)).size < sourceSize) { reused++; continue; }
      await rm(target, { force: true });
    }
    await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toFile(target);
    // 派生图比原图更大时没有收益，直接丢弃，卡片回退到原图。
    if ((await stat(target)).size >= sourceSize) { await rm(target, { force: true }); skipped++; } else generated++;
  }
}
console.log(`派生图就绪：生成 ${generated}，复用 ${reused}，跳过 ${skipped}（无体积收益），共 ${seen.size} 张原图`);
