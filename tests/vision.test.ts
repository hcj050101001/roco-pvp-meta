import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import sharp from 'sharp';
import { boundedPreview, prepareVision, PREVIEW_MAX_BYTES } from '../scripts/research/vision';

test('识图 JPEG 限制字节和尺寸，不放大小图', async () => {
  const input = await sharp(randomBytes(1200 * 900 * 3), { raw: { width: 1200, height: 900, channels: 3 } }).png().toBuffer();
  const result = await boundedPreview(input);
  assert.ok(result.length <= PREVIEW_MAX_BYTES);
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width! <= 1200 && meta.height! <= 900);
  const small = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#123456' } }).png().toBuffer();
  const smallMeta = await sharp(await boundedPreview(small)).metadata();
  assert.equal(smallMeta.width, 120); assert.equal(smallMeta.height, 80);
});

test('候选按 SHA 去重、保留原图字节和全部来源，拒绝路径穿越', async () => {
  const root = await mkdtemp(join(tmpdir(), 'roco-vision-'));
  try {
    const run = 'test-run';
    const input = await sharp({ create: { width: 1000, height: 800, channels: 3, background: '#abcdef' } }).png().toBuffer();
    const sha256 = createHash('sha256').update(input).digest('hex');
    await mkdir(join(root, run, 'a'), { recursive: true });
    await writeFile(join(root, 'latest.json'), JSON.stringify({ run_id: run }));
    const image = { sha256, file: `${sha256}.png` };
    const sources = [{ id: 'a', url: 'https://example.com/a', images: [image] }, { id: 'b', url: 'https://example.com/b', images: [image] }];
    await writeFile(join(root, run, 'a', image.file), input);
    await writeFile(join(root, run, 'manifest.json'), JSON.stringify({ sources }));
    const index = await prepareVision(root);
    assert.equal(index.candidates.length, 1);
    assert.deepEqual(index.candidates[0].references, sources.map(s => s.url));
    assert.ok(index.candidates[0].previews.length > 1);
    assert.equal(index.candidates[0].error, undefined);
    for (const preview of index.candidates[0].previews) assert.ok((await readFile(preview)).length <= PREVIEW_MAX_BYTES);
    assert.deepEqual(await readFile(join(root, run, 'a', image.file)), input);
    sources[0].images[0] = { sha256, file: '../../secret.png' };
    await writeFile(join(root, run, 'manifest.json'), JSON.stringify({ sources }));
    await assert.rejects(prepareVision(root), /Invalid candidate image path/);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('roco-vision-'));
    await rm(root, { recursive: true, force: true });
  }
});
