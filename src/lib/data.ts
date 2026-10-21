import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { lineupSchema, type Lineup } from './schema';
import state from '../../data/update-state.json' with { type: 'json' };
import { selectOverview, ranked, seasonNumber } from './rank';
import seasons from '../../data/seasons.json' with { type: 'json' };

export function readLineups(root = process.cwd()): Lineup[] {
  return ['data/lineups', 'data/archive'].flatMap(dir => {
    const path = resolve(root, dir);
    return existsSync(path) ? readdirSync(path).filter(f => f.endsWith('.json')).sort().map(f => {
      const l = lineupSchema.parse(JSON.parse(readFileSync(resolve(path,f),'utf8')));
      if (f !== `${l.slug}.json`) throw Error(`文件名与 slug 不一致: ${f}`);
      if (dir === 'data/archive' && l.status !== 'archived') throw Error('归档目录只接受 archived');
      return l;
    }) : [];
  });
}
export const allLineups = readLineups();
export const overview = selectOverview(allLineups, state.season);
export const activeLineups = overview.lineups;
export const historyLineups = ranked(allLineups.filter(l=>l.status==='archived' || seasonNumber(l.season)<seasonNumber(state.season)));
export const currentSeason = seasons.find(s=>s.id===state.season) || {id:state.season,name:state.version_label,theme:state.theme || 'classic',intro:''};
export { state, seasons };
