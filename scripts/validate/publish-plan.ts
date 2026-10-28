import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { allLineups, state, seasons } from '../../src/lib/data';
import { siteSignature } from '../../src/lib/publish';
import { basePath, siteUrl } from '../../src/lib/site';
const signature = siteSignature(allLineups, state, seasons);
let publish = true;
try {
  const response = await fetch(`${siteUrl}${basePath}/build-state.json`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  // schema 2 对应纯内容指纹；线上仍为 schema 1 时必然判定 publish=true 一次，
  // 那是指纹算法变更后的一次性迁移，不是内容变化，部署后新指纹即恢复正常比对。
  if (response.ok) {
    const remote = await response.json();
    publish = remote.schema !== 2 || remote.signature !== signature;
  }
} catch {
  console.log('无法读取线上内容指纹，保守执行验证与部署。');
}
const old = JSON.parse(
  execFileSync('git', ['show', 'HEAD:data/update-state.json'], { encoding: 'utf8' }),
);
const outputs = `publish=${publish}\nmajor=${old.season !== state.season}\n`;
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, outputs);
console.log(outputs.trim());
