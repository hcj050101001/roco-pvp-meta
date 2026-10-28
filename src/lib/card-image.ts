import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lineup } from './schema';
import { withBase } from './urls';

type LineupImage = Lineup['lineup_images'][number];
const widths = [320, 480, 800];
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
  } catch {
    /* 没有 manifest 文件时改用目录扫描 */
  }
  try {
    const files = new Set(readdirSync(dir).filter((f) => /\.(webp|avif)$/.test(f)));
    cachedManifest = { root, files };
    return files;
  } catch {
    return null;
  }
}

// derive-images.ts 只保留比原图更小的派生图，因此清单中有即代表有体积收益。
// 宽度小于原图宽度的派生图入选；WebP 为 img 回退，AVIF 为 picture source。
export function cardImageSources(img: LineupImage, root = process.cwd()) {
  const manifest = loadDerivedManifest(root);
  const hasDerived = (width: number, format: 'webp' | 'avif') =>
    manifest
      ? manifest.has(`${img.sha256}-${width}.${format}`)
      : existsSync(
          resolve(root, 'public/assets/lineups/derived', `${img.sha256}-${width}.${format}`),
        );
  const usable = widths.filter((w) => img.width > w && hasDerived(w, 'webp'));
  const avif = widths.filter((w) => img.width > w && hasDerived(w, 'avif'));
  if (!usable.length && !avif.length)
    return { src: withBase(img.path), srcset: undefined, avifSrcset: undefined, sizes: undefined };
  const url = (w: number, format: 'webp' | 'avif') =>
    withBase(`/assets/lineups/derived/${img.sha256}-${w}.${format}`);
  return {
    src: usable.length ? url(usable[usable.length - 1], 'webp') : withBase(img.path),
    srcset: usable.length ? usable.map((w) => `${url(w, 'webp')} ${w}w`).join(', ') : undefined,
    avifSrcset: avif.length ? avif.map((w) => `${url(w, 'avif')} ${w}w`).join(', ') : undefined,
    sizes,
  };
}
