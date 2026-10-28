import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadData } from '../../src/lib/data';
import { imageInfo } from '../extract/image';
const { allLineups: lineups } = loadData();
if (
  new Set(lineups.map((l) => l.slug)).size !== lineups.length ||
  new Set(lineups.map((l) => l.id)).size !== lineups.length
)
  throw Error('重复 slug/id');
for (const l of lineups)
  for (const img of l.lineup_images) {
    const bytes = await readFile(resolve('public', img.path.slice(1)));
    const info = await imageInfo(bytes);
    for (const key of ['width', 'height', 'sha256', 'phash'] as const)
      if (info[key] !== img[key]) throw Error(`${l.slug}: 图片 ${key} 不匹配`);
  }
console.log(`数据与图片校验通过：${lineups.length} 套阵容。`);
