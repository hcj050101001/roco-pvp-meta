import type { Lineup } from './schema';
export const rankScore = (l: Lineup) => Math.round((.35*l.strength_score + .25*l.recency_score + .2*l.popularity_score + .2*l.evidence_score)*10)/10;
export function ranked(lineups: Lineup[]) {
  return [...lineups].sort((a,b) => rankScore(b)-rankScore(a) || a.slug.localeCompare(b.slug));
}
export function selectActive(lineups: Lineup[], season: string) {
  const pool = ranked(lineups.filter(l => l.status === 'active' && l.season === season && l.lineup_images.some(i => i.verified)));
  const selected: Lineup[] = []; const deferred: Lineup[] = []; const types = new Map<string, number>();
  for (const l of pool) { const type = l.archetype[0]; if ((types.get(type) || 0) < 2) { selected.push(l); types.set(type,(types.get(type)||0)+1); } else deferred.push(l); }
  return [...selected,...deferred].slice(0,10);
}
