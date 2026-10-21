import * as cheerio from 'cheerio';
import { publicFetch } from './network';
export const allowedSource = (raw: string) => { try { const u=new URL(raw); return u.protocol==='https:' && ['3dmgame.com','qiandao.com','taptap.cn','bilibili.com','douyin.com','gamersky.com'].some(h=>u.hostname===h || u.hostname.endsWith('.'+h)); }catch{return false;} };
export function ingestSearch(html:string) {
  const $=cheerio.load(html,{xml:html.trimStart().startsWith('<?xml') || html.includes('<rss')});
  const urls:string[]=[];
  $('item').each((_,e)=>{const link=$(e).find('link').text().trim();if(allowedSource(link))urls.push(link);});
  $('a[href]').each((_,e)=>{const link=$(e).attr('href')!;if(allowedSource(link))urls.push(link);});
  return [...new Set(urls)];
}
export async function discover(queries:string[],save:(name:string,body:Buffer)=>Promise<void>) {
  const urls:string[]=[];const health=[];
  for(const [i,q] of queries.entries()) {
    try {const r=await publicFetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`,2_000_000);await save(`search-${i}.xml`,r.body);
      const found=ingestSearch(r.body.toString('utf8'));urls.push(...found);health.push({query:q,status:found.length?'ok':'no_results',results:found.length});
    } catch(e){health.push({query:q,status:'source_fetch_failed',error:String(e)});}
  }
  return {urls:[...new Set(urls)],health};
}
