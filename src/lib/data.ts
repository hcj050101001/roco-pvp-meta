import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { z } from 'zod';
import { lineupSchema, seasonsSchema, siteStateSchema, type Lineup } from './schema';
import { selectOverview, ranked, seasonNumber } from './rank';

export type Season = z.infer<typeof seasonsSchema>[number];
export type SiteState = z.infer<typeof siteStateSchema>;

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

export function loadState(root = process.cwd()): SiteState {
  const value: unknown = JSON.parse(readFileSync(resolve(root, 'data/update-state.json'), 'utf8'));
  return siteStateSchema.parse(value);
}

export function loadSeasons(root = process.cwd()): Season[] {
  const value: unknown = JSON.parse(readFileSync(resolve(root, 'data/seasons.json'), 'utf8'));
  return seasonsSchema.parse(value);
}

export function loadData(root = process.cwd()) {
  const allLineups = readLineups(root);
  const state = loadState(root);
  const seasons = loadSeasons(root);
  const currentSeason = seasons.find(s => s.id === state.season);
  if (!currentSeason) throw Error(`当前赛季未登记：${state.season}`);
  for (const lineup of allLineups) {
    if (!seasons.some(s => s.id === lineup.season)) throw Error(`${lineup.slug}: 赛季未登记：${lineup.season}`);
    if (seasonNumber(lineup.season) > seasonNumber(state.season)) throw Error(`${lineup.slug}: 阵容赛季晚于当前赛季`);
  }
  const overview = selectOverview(allLineups, state.season);
  return {
    allLineups,
    state,
    seasons,
    overview,
    activeLineups: overview.lineups,
    historyLineups: ranked(allLineups.filter(l => l.status === 'archived' || seasonNumber(l.season) < seasonNumber(state.season))),
    currentSeason,
  };
}

const store = loadData();
export const allLineups = store.allLineups;
export const state = store.state;
export const seasons = store.seasons;
export const overview = store.overview;
export const activeLineups = store.activeLineups;
export const historyLineups = store.historyLineups;
export const currentSeason = store.currentSeason;
