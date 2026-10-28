import { createHash } from 'node:crypto';
import type { Lineup } from './schema';

// 纯内容指纹：只由阵容、站点状态（除核对时间）与赛季数据决定，不依赖当前时间。
// 旧版曾混入随时间衰减的信号优先级，导致 45 天窗口过后内容零改动也会变指纹；
// 该行为已随 build-state schema 升到 2 一并废止，见 scripts/validate/build-state.ts。
export function siteSignature(lineups: Lineup[], state: Record<string, unknown>, seasons: unknown) {
  const { season_checked_at, ...contentState } = state;
  const ordered = [...lineups].sort((a,b)=>a.slug.localeCompare(b.slug));
  return createHash('sha256').update(JSON.stringify({ lineups:ordered, state:contentState, seasons })).digest('hex');
}
