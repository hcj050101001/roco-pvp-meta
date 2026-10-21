import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import sharp from 'sharp';

export const PREVIEW_MAX_BYTES = 192 * 1024;

// Only research previews are compressed; publication always uses the untouched original.
export async function boundedPreview(input: Buffer): Promise<Buffer> {
  for (const edge of [1280, 1024, 800, 640]) {
    const bytes = await sharp(input).rotate().resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    if (bytes.length <= PREVIEW_MAX_BYTES) return bytes;
  }
  throw Error('Image preview exceeds the request budget; preserve it for manual review');
}

export async function prepareVision(root = 'research/inbox') {
  const { run_id } = JSON.parse(await readFile(resolve(root, 'latest.json'), 'utf8'));
  if (!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('Invalid research run');
  const runRoot = resolve(root, run_id);
  const manifest = JSON.parse(await readFile(resolve(runRoot, 'manifest.json'), 'utf8'));
  const entries = new Map<string, { original: string; references: string[]; previews: string[]; bytes: number; error?: string }>();
  for (const source of manifest.sources) {
    if (!/^[a-zA-Z0-9-]+$/.test(source.id)) throw Error('Invalid source path');
    for (const image of source.images ?? []) {
      if (!image.sha256 || image.error) continue;
      if (!/^[a-f0-9]{64}$/.test(image.sha256) || !new RegExp(`^${image.sha256}\\.(png|jpe?g|webp|avif)$`).test(image.file))
        throw Error('Invalid candidate image path');
      const old = entries.get(image.sha256);
      if (old) { old.references.push(source.url); continue; }
      const original = posix.join(root.replaceAll('\\', '/'), run_id, source.id, image.file);
      const record: { original: string; references: string[]; previews: string[]; bytes: number; error?: string } = {
        original, references: [source.url], previews: [], bytes: 0,
      };
      entries.set(image.sha256, record);
      try {
        const input = await readFile(resolve(runRoot, source.id, image.file));
        const metadata = await sharp(input).metadata();
        if (!metadata.width || !metadata.height) throw Error('Invalid image dimensions');
        const output = resolve(runRoot, 'vision', image.sha256);
        await mkdir(output, { recursive: true });
        const save = async (name: string, bytes: Buffer) => {
          const preview = await boundedPreview(bytes);
          await writeFile(resolve(output, name), preview);
          record.previews.push(posix.join(root.replaceAll('\\', '/'), run_id, 'vision', image.sha256, name));
          record.bytes += preview.length;
        };
        await save('overview.jpg', input);
        // Natural-resolution tiles keep small text readable without inflated PNG enlargements.
        if (metadata.width > 900 || metadata.height > 700) {
          for (let top = 0; top < metadata.height; top += 448) {
            for (let left = 0; left < metadata.width; left += 704) {
              const width = Math.min(768, metadata.width - left), height = Math.min(512, metadata.height - top);
              const tile = await sharp(input).extract({ left, top, width, height }).png().toBuffer();
              await save(`tile-${top}-${left}.jpg`, tile);
            }
          }
        }
      } catch (error) {
        record.error = String(error);
      }
    }
  }
  const index = { run_id, preview_max_bytes: PREVIEW_MAX_BYTES, candidates: [...entries.entries()].map(([sha256, record]) => ({ sha256, ...record })) };
  await mkdir(resolve(runRoot, 'vision'), { recursive: true });
  await writeFile(resolve(runRoot, 'vision', 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Vision previews: ${entries.size} unique candidates, ${index.candidates.reduce((n, c) => n + c.previews.length, 0)} bounded JPEGs; originals unchanged.`);
  return index;
}
