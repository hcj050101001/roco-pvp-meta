import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Explicitly supplied local public-video copy only. No cookies, DRM or login support.
const [input, output] = process.argv.slice(2);
if (!input || !output || !/^[a-z0-9/_-]+$/i.test(output.replaceAll('\\', '/')))
  throw Error(
    '用法: npx tsx scripts/extract/video.ts <本地公开视频> <research/inbox/run/videos/id/frames>',
  );
const out = resolve(output);
const inbox = resolve('research/inbox');
if (!out.startsWith(inbox + (process.platform === 'win32' ? '\\' : '/')))
  throw Error('只允许输出到 research/inbox/');
await mkdir(out, { recursive: true });
const r = spawnSync(
  'ffmpeg',
  [
    '-i',
    resolve(input),
    '-vf',
    "select='gt(scene,0.32)',scale=1600:-1",
    '-vsync',
    'vfr',
    '-frames:v',
    '40',
    resolve(out, 'frame-%04d.jpg'),
  ],
  { stdio: 'inherit', shell: false },
);
if (r.error || r.status !== 0) throw Error(`ffmpeg 失败: ${r.error || r.status}`);
