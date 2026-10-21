import { readFile,writeFile,mkdir } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { publicFetch } from './network';
import { officialSeason,latestLaunched,type SeasonEvidence } from '../../src/lib/season';
const state=JSON.parse(await readFile('data/update-state.json','utf8'));
const seasons=JSON.parse(await readFile('data/seasons.json','utf8'));
const now=new Date();const run=`research/runs/season-${now.toISOString().replace(/[:.]/g,'-')}`;await mkdir(run,{recursive:true});
const urls=new Set<string>([state.season_source]);const health:unknown[]=[];
try {
  const r=await publicFetch('https://www.taptap.cn/app/188212/topic?type=official');const doc=cheerio.load(r.body.toString('utf8'));
  for(const e of doc('a[href*="/moment/"]').toArray()){
    const title=doc(e).text();if(/S\d+赛季/.test(title)&&/开服公告|正式启幕|正式上线/.test(title)){
      const u=new URL(doc(e).attr('href')!,'https://www.taptap.cn');if(u.hostname==='www.taptap.cn')urls.add(u.href.split('?')[0]);
    }
  }
  await writeFile(`${run}/official-index.html`,r.body);
}catch(e){health.push({source:'official-index',status:'unavailable',error:String(e)});}
const evidence:SeasonEvidence[]=[];
for(const [i,url] of [...urls].slice(0,12).entries()){
  try{const r=await publicFetch(url);const html=r.body.toString('utf8');await writeFile(`${run}/announcement-${i}.html`,html);
    const candidate=officialSeason(html,url,now);if(candidate)evidence.push(candidate);health.push({url,status:candidate?'confirmed':'not-a-launched-season'});
  }catch(e){health.push({url,status:'unavailable',error:String(e)});}
}
const next=latestLaunched(evidence,state.season);const changed=Boolean(next&&next.id!==state.season);
if(next){
  if(changed){
    state.season_transitions=[...(state.season_transitions||[]),{from:state.season,to:next.id,confirmed_at:now.toISOString(),source_url:next.source_url,kind:'major-season-update'}];
    state.previous_season=state.season;state.season=next.id;state.version_label=next.name;state.theme=next.theme;
    state.season_source=next.source_url;state.season_revision=(state.season_revision||1)+1;state.major_update_required=true;state.balance_patch_date=null;
    if(!seasons.some((s:any)=>s.id===next.id)){seasons.push({...next,intro:'新赛季配队陆续更新，往期阵容可作过渡参考。'});await writeFile('data/seasons.json',JSON.stringify(seasons,null,2)+'\n');}
    state.notice='新赛季配队陆续更新，往期阵容仅作过渡参考。';
  }
  state.season_checked_at=now.toISOString();
  await writeFile('data/update-state.json',JSON.stringify(state,null,2)+'\n');
}
await writeFile(`${run}/check.json`,JSON.stringify({checked_at:now.toISOString(),changed,current:state.season,evidence,health},null,2)+'\n');
console.log(next?`官方赛季已核对：${next.id} ${next.name}${changed?'，已记录重大更新，保留往期阵容过渡。':''}`:'来源暂不可核实，保留当前赛季与所有阵容。');
