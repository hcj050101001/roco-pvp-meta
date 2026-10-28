import type { Lineup } from './schema';
import { configurationDate } from './rank';

/** 配置图发布日期；未标注日期的阵容保留在末尾。 */
export function timelineLineups(lineups: Lineup[]): Lineup[] {
  return [...lineups]
    .filter((lineup) => lineup.lineup_images.some((image) => image.verified))
    .sort(
      (a, b) =>
        configurationDate(b).localeCompare(configurationDate(a)) || a.slug.localeCompare(b.slug),
    );
}
