import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardImageSources } from '../src/lib/card-image';
import { allLineups } from '../src/lib/data';

function fixture(run: (root: string, dir: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'roco-card-image-'));
  const dir = join(root, 'public/assets/lineups/derived');
  try {
    mkdirSync(dir, { recursive: true });
    run(root, dir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const image = { ...allLineups[0].lineup_images[0], width: 1200 };
const file = (width: number, format = 'webp') => `${image.sha256}-${width}.${format}`;

test('cardImageSources 没有派生图时保留完整原图且不声明 srcset', () => {
  fixture((root) => {
    assert.deepEqual(cardImageSources(image, root), {
      src: image.path,
      srcset: undefined,
      avifSrcset: undefined,
      sizes: undefined,
    });
  });
});

test('cardImageSources 支持两种清单格式、320 档及 AVIF，只选择小于原图宽度的派生图', () => {
  const files = [
    file(320),
    file(480),
    file(800),
    file(320, 'avif'),
    file(480, 'avif'),
    file(800, 'avif'),
  ];
  for (const manifest of [files, { files: [...files, null] }]) {
    fixture((root, dir) => {
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
      const sources = cardImageSources(image, root);
      assert.equal(sources.src, `/assets/lineups/derived/${file(800)}`);
      assert.equal(
        sources.srcset,
        `/assets/lineups/derived/${file(320)} 320w, /assets/lineups/derived/${file(480)} 480w, /assets/lineups/derived/${file(800)} 800w`,
      );
      assert.equal(
        sources.avifSrcset,
        `/assets/lineups/derived/${file(320, 'avif')} 320w, /assets/lineups/derived/${file(480, 'avif')} 480w, /assets/lineups/derived/${file(800, 'avif')} 800w`,
      );
      assert.ok(sources.sizes?.includes('580px'));
      assert.equal(
        cardImageSources({ ...image, width: 800 }, root).src,
        `/assets/lineups/derived/${file(480)}`,
      );
      assert.equal(cardImageSources({ ...image, width: 320 }, root).src, image.path);
    });
  }
});

test('cardImageSources 清单损坏时扫描目录，忽略无关文件并支持单一宽度', () => {
  fixture((root, dir) => {
    writeFileSync(join(dir, 'manifest.json'), '{');
    writeFileSync(join(dir, file(480)), 'fixture');
    writeFileSync(join(dir, file(320, 'avif')), 'fixture');
    writeFileSync(join(dir, file(800) + '.jpg'), 'fixture');
    const sources = cardImageSources(image, root);
    assert.equal(sources.src, `/assets/lineups/derived/${file(480)}`);
    assert.equal(sources.srcset, `${sources.src} 480w`);
    assert.equal(sources.avifSrcset, `/assets/lineups/derived/${file(320, 'avif')} 320w`);
  });
});

test('cardImageSources 不缓存不存在的目录，稍后派生图可用时重新读取', () => {
  fixture((root, dir) => {
    rmSync(dir, { recursive: true });
    assert.equal(cardImageSources(image, root).src, image.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file(800)), 'fixture');
    assert.equal(cardImageSources(image, root).src, `/assets/lineups/derived/${file(800)}`);
  });
});
