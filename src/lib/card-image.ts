import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lineup } from './schema';
import { withBase } from './urls';

type LineupImage = Lineup['lineup_images'][number];
const widths = [480, 800];
const sizes = '(max-width: 580px) 92vw, (max-width: 1100px) 46vw, 380px';

// 派生图清单：构建时 derive-images 先于渲染运行，因此同一进程内只需扫描一次。
// 清单来源按优先级：1) derived/manifest.json（若派生步骤写出该文件，接受文件名数组
// 或 { files: [...] }）；2) derived 目录的一次性扫描。两种来源都不可用（例如本地
// 开发尚未跑 derive-images）时不缓存失败结果，回落到逐张 existsSync，保证不中断。
// 注意：清单只在进程内缓存；派生图在渲染中途新增的场景不在构建流程内，不予处理。
let cachedManifest: { root: string; files: Set<string> } | null = null;

function loadDerivedManifest(root: string): Set<string> | null {
  if (cachedManifest && cachedManifest.root === root) return cachedManifest.files;
  const dir = resolve(root, 'public/assets/lineups/derived');
  try {
    const parsed: unknown = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    const names = Array.isArray(parsed) ? parsed : (parsed as { files?: unknown }).files;
    if (Array.isArray(names)) {
      const files = new Set(names.filter((n): n is string => typeof n === 'string'));
      cachedManifest = { root, files };
      return files;
    }
  } catch { /* 没有 manifest 文件时改用目录扫描 */ }
  try {
    const files = new Set(readdirSync(dir).filter(f => f.endsWith('.webp')));
    cachedManifest = { root, files };
    return files;
  } catch {
    return null;
  }
}

// derive-images.ts 只保留比原图更小的派生图，因此清单中有即代表有体积收益。
// 选择规则不变：宽度小于原图宽度的派生图全部入选，src 取最大宽度，srcset/sizes 不变。
export function cardImageSources(img: LineupImage, root = process.cwd()) {
  const manifest = loadDerivedManifest(root);
  const hasDerived = (width: number) => manifest
    ? manifest.has(`${img.sha256}-${width}.webp`)
    : existsSync(resolve(root, 'public/assets/lineups/derived', `${img.sha256}-${width}.webp`));
  const usable = widths.filter(w => img.width > w && hasDerived(w));
  if (!usable.length) return { src: withBase(img.path), srcset: undefined, sizes: undefined };
  const url = (w: number) => withBase(`/assets/lineups/derived/${img.sha256}-${w}.webp`);
  return { src: url(usable[usable.length - 1]), srcset: usable.map(w => `${url(w)} ${w}w`).join(', '), sizes };
}
