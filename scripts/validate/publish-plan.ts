import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { allLineups, state, seasons } from '../../src/lib/data';
import { siteSignature } from '../../src/lib/publish';
const repository=process.env.GITHUB_REPOSITORY || 'hcj050101001/roco-pvp-meta';
if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw Error('无效仓库名');
const [owner,name]=repository.split('/');
const base=name===`${owner}.github.io`?'':`/${name}`;
const signature=siteSignature(allLineups,state,seasons);
let publish=true;
try {
  const response=await fetch(`https://${owner}.github.io${base}/build-state.json`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(response.ok){const remote=await response.json();publish=remote.schema!==1||remote.signature!==signature;}
}catch { console.log('无法读取线上内容指纹，保守执行验证与部署。'); }
const old=JSON.parse(execFileSync('git',['show','HEAD:data/update-state.json'],{encoding:'utf8'}));
const outputs=`publish=${publish}\nmajor=${old.season!==state.season}\n`;
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,outputs);
console.log(outputs.trim());
