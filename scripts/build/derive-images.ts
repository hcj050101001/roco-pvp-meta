import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLineups } from '../../src/lib/data';

const widths = [320, 480, 800];
const formats = ['webp', 'avif'] as const;
const root = process.cwd();
const output = resolve(root, 'public/assets/lineups/derived');
await mkdir(output, { recursive: true });

const seen = new Set<string>();
const kept = new Set<string>();
let generated = 0,
  reused = 0,
  skipped = 0;
for (const image of readLineups(root).flatMap((lineup) => lineup.lineup_images)) {
  if (seen.has(image.sha256)) continue;
  seen.add(image.sha256);
  const source = resolve(root, `public${image.path}`);
  if (!existsSync(source)) throw Error(`原图不存在: ${image.path}`);
  const sourceSize = (await stat(source)).size;
  for (const width of widths) {
    if (image.width <= width) continue;
    for (const format of formats) {
      const file = `${image.sha256}-${width}.${format}`;
      const target = resolve(output, file);
      if (existsSync(target)) {
        if ((await stat(target)).size < sourceSize) {
          reused++;
          kept.add(file);
          continue;
        }
        await rm(target, { force: true });
      }
      const resized = sharp(source).resize({ width, withoutEnlargement: true });
      if (format === 'webp') await resized.webp({ quality: 78, effort: 4 }).toFile(target);
      else await resized.avif({ quality: 55, effort: 4 }).toFile(target);
      // 派生图比原图更大时没有收益，直接丢弃，卡片回退到原图。
      if ((await stat(target)).size >= sourceSize) {
        await rm(target, { force: true });
        skipped++;
      } else {
        generated++;
        kept.add(file);
      }
    }
  }
}
// 供 card-image.ts 优先读取的清单：只含实际保留且有体积收益的派生图文件名。
await writeFile(resolve(output, 'manifest.json'), JSON.stringify([...kept].sort(), null, 2) + '\n');
console.log(
  `派生图就绪：生成 ${generated}，复用 ${reused}，跳过 ${skipped}（无体积收益），共 ${seen.size} 张原图`,
);
