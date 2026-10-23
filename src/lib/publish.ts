import { createHash } from 'node:crypto';
import { signalPriority } from './rank';
import type { Lineup } from './schema';

export function siteSignature(lineups: Lineup[], state: Record<string, unknown>, seasons: unknown, now = Date.now()) {
  const { season_checked_at, ...contentState } = state;
  const ordered = [...lineups].sort((a,b)=>a.slug.localeCompare(b.slug));
  return createHash('sha256').update(JSON.stringify({ lineups:ordered, state:contentState, seasons,
    priorities:ordered.map(l=>[l.slug,signalPriority(l,now)]) })).digest('hex');
}
