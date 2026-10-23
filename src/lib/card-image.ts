import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lineup } from './schema';
import { withBase } from './urls';

type LineupImage = Lineup['lineup_images'][number];
const widths = [480, 800];
const sizes = '(max-width: 580px) 92vw, (max-width: 1100px) 46vw, 380px';

// derive-images.ts 只保留比原图更小的派生图，因此存在即代表有体积收益。
export function cardImageSources(img: LineupImage) {
  const usable = widths.filter(w => img.width > w && existsSync(resolve(process.cwd(), 'public/assets/lineups/derived', `${img.sha256}-${w}.webp`)));
  if (!usable.length) return { src: withBase(img.path), srcset: undefined, sizes: undefined };
  const url = (w: number) => withBase(`/assets/lineups/derived/${img.sha256}-${w}.webp`);
  return { src: url(usable[usable.length - 1]), srcset: usable.map(w => `${url(w)} ${w}w`).join(', '), sizes };
}
