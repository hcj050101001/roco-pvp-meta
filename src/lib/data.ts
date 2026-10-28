import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { z } from 'zod';
import { lineupSchema, seasonsSchema, siteStateSchema, type Lineup } from './schema';
import { selectOverview, ranked, seasonNumber } from './rank';

export type Season = z.infer<typeof seasonsSchema>[number];
export type SiteState = z.infer<typeof siteStateSchema>;

// 按解析后的根目录缓存解析结果，但缓存有效性由文件指纹（文件名 + 修改时间 +
// 大小）决定：构建时同一根目录不重复解析全部 JSON，而同进程内先写后读
// （例如 promoteContent 写完再 loadData 校验）仍能看到新文件，见 promotion 测试。
// stat 是廉价操作，解析 + Zod 校验才是被缓存的昂贵部分。
// 调用方不得改动返回的对象（与原先的模块级导出共享引用一致）；
// 需要可变副本时请先 structuredClone。
function statKey(path: string): string {
  try {
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return 'missing';
  }
}

function lineupsFingerprint(root: string): string {
  return ['data/lineups', 'data/archive']
    .map((dir) => {
      const path = resolve(root, dir);
      if (!existsSync(path)) return `${dir}:missing`;
      return (
        `${dir}:` +
        readdirSync(path)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => `${f}@${statKey(resolve(path, f))}`)
          .join(',')
      );
    })
    .join('|');
}

const lineupsCache = new Map<string, { fingerprint: string; value: Lineup[] }>();
const stateCache = new Map<string, { fingerprint: string; value: SiteState }>();
const seasonsCache = new Map<string, { fingerprint: string; value: Season[] }>();

function computeLineups(root: string): Lineup[] {
  return ['data/lineups', 'data/archive'].flatMap((dir) => {
    const path = resolve(root, dir);
    return existsSync(path)
      ? readdirSync(path)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => {
            const l = lineupSchema.parse(JSON.parse(readFileSync(resolve(path, f), 'utf8')));
            if (f !== `${l.slug}.json`) throw Error(`文件名与 slug 不一致: ${f}`);
            if (dir === 'data/archive' && l.status !== 'archived')
              throw Error('归档目录只接受 archived');
            return l;
          })
      : [];
  });
}

export function readLineups(root = process.cwd()): Lineup[] {
  const key = resolve(root);
  const fingerprint = lineupsFingerprint(key);
  const hit = lineupsCache.get(key);
  if (hit && hit.fingerprint === fingerprint) return hit.value;
  const lineups = computeLineups(key);
  lineupsCache.set(key, { fingerprint, value: lineups });
  return lineups;
}

export function loadState(root = process.cwd()): SiteState {
  const key = resolve(root);
  const path = resolve(key, 'data/update-state.json');
  const fingerprint = statKey(path);
  const hit = stateCache.get(key);
  if (hit && hit.fingerprint === fingerprint) return hit.value;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const state = siteStateSchema.parse(value);
  stateCache.set(key, { fingerprint, value: state });
  return state;
}

export function loadSeasons(root = process.cwd()): Season[] {
  const key = resolve(root);
  const path = resolve(key, 'data/seasons.json');
  const fingerprint = statKey(path);
  const hit = seasonsCache.get(key);
  if (hit && hit.fingerprint === fingerprint) return hit.value;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const seasons = seasonsSchema.parse(value);
  seasonsCache.set(key, { fingerprint, value: seasons });
  return seasons;
}

function computeLoadData(root: string) {
  const allLineups = readLineups(root);
  const state = loadState(root);
  const seasons = loadSeasons(root);
  const currentSeason = seasons.find((s) => s.id === state.season);
  if (!currentSeason) throw Error(`当前赛季未登记：${state.season}`);
  for (const lineup of allLineups) {
    if (!seasons.some((s) => s.id === lineup.season))
      throw Error(`${lineup.slug}: 赛季未登记：${lineup.season}`);
    if (seasonNumber(lineup.season) > seasonNumber(state.season))
      throw Error(`${lineup.slug}: 阵容赛季晚于当前赛季`);
  }
  const overview = selectOverview(allLineups, state.season);
  return {
    allLineups,
    state,
    seasons,
    overview,
    activeLineups: overview.lineups,
    historyLineups: ranked(
      allLineups.filter(
        (l) => l.status === 'archived' || seasonNumber(l.season) < seasonNumber(state.season),
      ),
    ),
    currentSeason,
  };
}

// loadData 本身不另设缓存：派生计算（排序、概览选择）相对解析很便宜，
// 且每次都经由上面带指纹的组件加载，因此写后读一定能看到新数据，
// 这也与原先 loadData 每次返回新派生对象的语义一致。
export function loadData(root = process.cwd()) {
  return computeLoadData(resolve(root));
}

const store = loadData();
export const allLineups = store.allLineups;
export const state = store.state;
export const seasons = store.seasons;
export const overview = store.overview;
export const activeLineups = store.activeLineups;
export const historyLineups = store.historyLineups;
export const currentSeason = store.currentSeason;
