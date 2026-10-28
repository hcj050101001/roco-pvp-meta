import type { Lineup } from './schema';
// Discovery order, never a strength rating. All valid signals share one priority group.
export function signalPriority(l: Lineup, now = Date.now()) {
  return Number(
    l.signals.some((s) => {
      const age = now - Date.parse(s.observed_at);
      return age >= 0 && age <= 45 * 86400000;
    }),
  );
}
export function configurationDate(l: Lineup) {
  // An index refresh or a new verification is not the configuration's publication date.
  const date = l.lineup_images[0].published_at;
  return date ? new Date(date).toISOString() : '';
}
export const seasonNumber = (season: string) => Number(season.replace(/^S/i, '')) || 0;
export function ranked(lineups: Lineup[], now = Date.now()) {
  return [...lineups].sort(
    (a, b) =>
      signalPriority(b, now) - signalPriority(a, now) ||
      configurationDate(b).localeCompare(configurationDate(a)) ||
      a.slug.localeCompare(b.slug),
  );
}
export function selectActive(lineups: Lineup[], season: string) {
  return ranked(
    lineups.filter(
      (l) =>
        l.status === 'active' && l.season === season && l.lineup_images.some((i) => i.verified),
    ),
  );
}
export function selectOverview(lineups: Lineup[], season: string, minimum = 3) {
  const current = selectActive(lineups, season);
  if (current.length >= minimum)
    return { current, fallback: [] as Lineup[], lineups: current, transition: false };
  const older = lineups.filter(
    (l) => seasonNumber(l.season) < seasonNumber(season) && l.lineup_images.some((i) => i.verified),
  );
  const lastSeason = Math.max(0, ...older.map((l) => seasonNumber(l.season)));
  const fallback = ranked(older.filter((l) => seasonNumber(l.season) === lastSeason));
  return { current, fallback, lineups: [...current, ...fallback], transition: fallback.length > 0 };
}
