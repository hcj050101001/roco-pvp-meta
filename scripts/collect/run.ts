import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { extractPage } from '../extract/page';
import { publicFetch } from './network';
import { imageInfo } from '../extract/image';
import { discover } from './search';
import { publicBrowserSnapshot } from './browser';

const sources=JSON.parse(await readFile('data/sources.json','utf8')) as {id:string;platform:string;url:string;enabled:boolean}[];
const seedIndex=process.argv.indexOf('--seeds');
if(seedIndex>=0) { const seeds=JSON.parse(await readFile(process.argv[seedIndex+1],'utf8')); for(const [i,s] of seeds.entries()) sources.push({id:`seed-${i}`,platform:'general',url:typeof s==='string'?s:s.url,enabled:true}); }
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const root=resolve('research/inbox',runId); await mkdir(root,{recursive:true});
const records: Record<string,unknown>[]=[];
let searchHealth:unknown[]=[];
if(process.argv.includes('--discover')) {
  const currentState=JSON.parse(await readFile('data/update-state.json','utf8'));
  const queries=(JSON.parse(await readFile('data/search-queries.json','utf8')) as string[]).map(q=>q.replace(/S\d+/g,currentState.season));
  const found=await discover(queries,(name,body)=>writeFile(join(root,name),body));
  searchHealth=found.health;
  const known=new Set(sources.map(s=>s.url));
  for(const [i,url] of found.urls.filter(u=>!known.has(u)).slice(0,24).entries())sources.push({id:`discovered-${i}`,platform:new URL(url).hostname,url,enabled:true});
}
for(const source of sources.filter(s=>s.enabled)) {
  const folder=join(root,source.id); await mkdir(folder,{recursive:true});
  try {
    const r=await publicFetch(source.url,8_000_000); let html=r.body.toString('utf8');
    const visibleTitle=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    // Optional site login dialogs do not make the public article access-restricted.
    if (/访问验证|安全验证|请完成验证|Access Denied|验证码|验证中心/i.test(visibleTitle) || /bili-risk-control|captcha-container/i.test(html) || html.length<300) throw Error('访问受限或响应不完整');
    if(process.argv.includes('--browser') && /qiandao|taptap|bilibili|douyin/.test(source.platform)) {
      const snapshot=await publicBrowserSnapshot(source.url);html=snapshot.html;await writeFile(join(folder,'page.png'),snapshot.screenshot);
    }
    await writeFile(join(folder,'page.html'),html);
    const extracted=extractPage(html,r.url); await writeFile(join(folder,'page.json'),JSON.stringify(extracted,null,2)+'\n');
    const downloads=[];
    // Download article/CDN candidates; icons stay indexed but are not bulk downloaded.
    const candidates=extracted.images.filter(i=>/\/uploads\/images\/raiders\/|qiandaocdn|taptap|hdslb|douyinpic/.test(i.url) && !/avatar|logo|icon|qrcode/i.test(i.url));
    for(const img of candidates.slice(0,50)) {
      try { const res=await publicFetch(img.url); if(!res.type.startsWith('image/')) throw Error('非图片响应');
        const info=await imageInfo(res.body); const file=`${info.sha256}.${info.format==='jpeg'?'jpg':info.format}`;
        if(info.width<300 || info.height<200)continue;
        await writeFile(join(folder,file),res.body); downloads.push({...img,...info,file,verified:false,mapping_confidence:img.context.includes('队')?'context-only':'unmapped'});
      } catch(e) { downloads.push({...img,error:String(e),verified:false}); }
    }
    records.push({...source,status:'ok',title:extracted.title,images:downloads,image_nodes:extracted.images.length,checked_at:new Date().toISOString()});
    console.log(`${source.id}: OK, ${downloads.length} 张候选图（尚未验证）`);
  } catch(e) { records.push({...source,status:'source_fetch_failed',error:String(e),checked_at:new Date().toISOString()}); console.log(`${source.id}: ${String(e)}`); }
}
await writeFile(join(root,'manifest.json'),JSON.stringify({run_id:runId,created_at:new Date().toISOString(),untrusted:true,search_health:searchHealth,sources:records},null,2)+'\n');
await writeFile(resolve('research/inbox/latest.json'),JSON.stringify({run_id:runId})+'\n');
console.log(`研究记录：${root}。采集不会修改生产数据。`);
