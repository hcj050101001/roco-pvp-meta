import { writeFile,mkdir } from 'node:fs/promises';
import { allLineups } from '../../src/lib/data';
import { publicFetch } from '../collect/network';
const urls=[...new Set(allLineups.flatMap(l=>[...l.sources.map(s=>s.url),...l.tutorials.map(t=>t.url),...l.lineup_images.map(i=>i.source_url)]))];
const results=[];
for(const url of urls) { try {const r=await publicFetch(url);results.push({url,status:'ok',type:r.type});} catch(e){results.push({url,status:'unavailable',error:String(e)});} }
await mkdir('research/runs/link-check',{recursive:true});
await writeFile('research/runs/link-check/latest.json',JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
console.log(`外链检查 ${results.filter(r=>r.status==='ok').length}/${urls.length} 可访问。失败仅报告，不删除生产数据。`);
if(results.some(r=>r.status!=='ok')) process.exitCode=1;
