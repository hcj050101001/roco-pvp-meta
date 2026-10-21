import type { Lineup } from './schema';
export const rankScore = (l: Lineup) => Math.round((.35*l.strength_score + .25*l.recency_score + .2*l.popularity_score + .2*l.evidence_score)*10)/10;
export const tiers = ['T0','T1','T2','T3','待定'] as const;
export const tierDescriptions:Record<string,string> = {T0:'环境领衔',T1:'主流上分',T2:'对策与进阶',T3:'娱乐与尝试',待定:'更多体系'};
export const seasonNumber = (season:string) => Number(season.replace(/^S/i,'')) || 0;
export function ranked(lineups: Lineup[]) {
  return [...lineups].sort((a,b) => tiers.indexOf(a.tier)-tiers.indexOf(b.tier) || rankScore(b)-rankScore(a) || a.slug.localeCompare(b.slug));
}
export function selectActive(lineups: Lineup[], season: string) {
  return ranked(lineups.filter(l => l.status === 'active' && l.season === season && l.lineup_images.some(i => i.verified)));
}
export function selectOverview(lineups:Lineup[], season:string, minimum=3) {
  const current=selectActive(lineups,season);
  if(current.length>=minimum)return {current,fallback:[] as Lineup[],lineups:current,transition:false};
  const older=lineups.filter(l=>seasonNumber(l.season)<seasonNumber(season) && l.lineup_images.some(i=>i.verified));
  const lastSeason=Math.max(0,...older.map(l=>seasonNumber(l.season)));
  const fallback=ranked(older.filter(l=>seasonNumber(l.season)===lastSeason));
  return {current,fallback,lineups:[...current,...fallback],transition:fallback.length>0};
}
