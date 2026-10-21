import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { readLineups } from '../../src/lib/data';
import { guardRefresh } from '../../src/lib/refresh';
const current=readLineups();
await mkdir('research',{recursive:true});
if(process.argv.includes('--snapshot')) { await writeFile('research/baseline.json',JSON.stringify(current,null,2)+'\n'); console.log('已保存更新前快照'); }
else {
  const previous=JSON.parse(await readFile('research/baseline.json','utf8')) as typeof current;
  const {run_id}=JSON.parse(await readFile('research/inbox/latest.json','utf8'));
  if(!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效研究路径');
  const manifest=JSON.parse(await readFile(`research/inbox/${run_id}/manifest.json`,'utf8'));
  guardRefresh(previous,current,manifest.sources.filter((s:any)=>s.status==='ok').map((s:any)=>s.url));
  console.log('非破坏性更新检查通过。');
}
