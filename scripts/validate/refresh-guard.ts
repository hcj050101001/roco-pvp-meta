import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { readLineups } from '../../src/lib/data';
import { guardRefresh } from '../../src/lib/refresh';
import { execFileSync } from 'node:child_process';
import { lineupSchema } from '../../src/lib/schema';
import { readChangeEvidence } from './change-evidence';
const current=readLineups();
await mkdir('research',{recursive:true});
if(process.argv.includes('--snapshot')) { await writeFile('research/baseline.json',JSON.stringify(current,null,2)+'\n'); console.log('已保存更新前快照'); }
else {
  // The baseline comes from the checkout, never from model-writable artifacts.
  const ref=process.env.REFRESH_BASE_SHA || 'HEAD';
  if(ref!=='HEAD'&&!/^[a-f0-9]{40}$/.test(ref))throw Error('无效基线提交');
  const paths=execFileSync('git',['ls-tree','-r','--name-only',ref,'--','data/lineups','data/archive'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.endsWith('.json'));
  const previous=paths.map(path=>lineupSchema.parse(JSON.parse(execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8'}))));
  const {run_id}=JSON.parse(await readFile('research/inbox/latest.json','utf8'));
  if(!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效研究路径');
  const {evidence,accessibleUrls}=await readChangeEvidence(run_id);
  guardRefresh(previous,current,accessibleUrls,evidence);
  console.log('非破坏性更新检查通过。');
}
