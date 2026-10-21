import { readFile,copyFile,mkdir,unlink } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { readLineups } from '../../src/lib/data';
import { imageInfo } from '../extract/image';
const staging=resolve('.refresh-content');
const previous=readLineups(),proposed=readLineups(staging);
if(!proposed.length || new Set(proposed.map(l=>l.id)).size!==proposed.length || new Set(proposed.map(l=>l.slug)).size!==proposed.length)throw Error('候选数据库为空或重复');
for(const old of previous) if(!proposed.some(l=>l.id===old.id && l.slug===old.slug))throw Error(`候选缺少既有记录: ${old.name}`);
// Validate all proposed bytes before any mutation. Old assets are never removed.
for(const l of proposed) for(const img of l.lineup_images){
  const info=await imageInfo(await readFile(resolve(staging,'public',img.path.slice(1))));
  if(info.sha256!==img.sha256 || info.width!==img.width || info.height!==img.height || info.phash!==img.phash)throw Error('候选图片与记录不一致');
}
for(const l of proposed){
  const folder=l.status==='archived'?'archive':'lineups';
  const destination=resolve('data',folder,`${l.slug}.json`);await mkdir(dirname(destination),{recursive:true});
  await copyFile(resolve(staging,'data',folder,`${l.slug}.json`),destination);
  const old=previous.find(p=>p.id===l.id);
  if(old && (old.status==='archived')!==(l.status==='archived'))await unlink(resolve('data',old.status==='archived'?'archive':'lineups',`${old.slug}.json`));
  for(const img of l.lineup_images){const target=resolve('public',img.path.slice(1));await mkdir(dirname(target),{recursive:true});await copyFile(resolve(staging,'public',img.path.slice(1)),target);}
}
for(const filename of ['sources.json','update-state.json','seasons.json','updates.json','search-queries.json'])await copyFile(resolve(staging,'data',filename),resolve('data',filename));
console.log(`已应用 ${proposed.length} 条候选资料，既有 ID 和旧图片均保留。`);
