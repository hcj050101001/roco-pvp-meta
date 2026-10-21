import type { Lineup } from './schema';
export function guardRefresh(previous:Lineup[],current:Lineup[],accessibleUrls:string[]) {
  for(const old of previous) {
    const next=current.find(l=>l.id===old.id);if(!next)throw Error(`不允许硬删除既有阵容：${old.name}`);
    if(JSON.stringify(old.roster.map(p=>p.name))!==JSON.stringify(next.roster.map(p=>p.name)))
      throw Error(`自动更新不允许改写既有成员名称：${old.name}；请将名称修订留在候选记录中`);
    if(!accessibleUrls.some(url=>next.sources.some(s=>s.url===url)) && JSON.stringify(old)!==JSON.stringify(next))throw Error(`来源均失败时不允许更改：${old.name}`);
    if(old.status!=='archived' && next.status==='archived' && !next.archive_reason)throw Error('归档缺少理由');
  }
  if(previous.some(l=>l.status==='active')&&!current.some(l=>l.status==='active'))throw Error('不允许空结果替换生产');
}
