import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { lineupSchema, type Lineup } from './schema';
import { selectOverview, ranked, seasonNumber } from './rank';

export interface Season {
  id: string;
  name: string;
  theme?: string;
  started_at?: string;
  source_url?: string;
  intro: string;
}

export interface SiteState {
  season: string;
  version_label: string;
  theme?: string;
  [key: string]: unknown;
}

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
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof (value as SiteState).season !== 'string' || typeof (value as SiteState).version_label !== 'string')
    throw Error('update-state.json 缺少 season/version_label');
  return value as SiteState;
}

export function loadSeasons(root = process.cwd()): Season[] {
  const value: unknown = JSON.parse(readFileSync(resolve(root, 'data/seasons.json'), 'utf8'));
  if (!Array.isArray(value)) throw Error('seasons.json 必须是数组');
  return value as Season[];
}

export function loadData(root = process.cwd()) {
  const allLineups = readLineups(root);
  const state = loadState(root);
  const seasons = loadSeasons(root);
  const overview = selectOverview(allLineups, state.season);
  const currentSeason = seasons.find(s => s.id === state.season)
    || { id: state.season, name: state.version_label, theme: state.theme || 'classic', intro: '' };
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
