import type { APIRoute } from 'astro';
import { activeLineups, historyLineups, overview } from '../lib/data';
import { cardImageSources } from '../lib/card-image';
import { configurationDate } from '../lib/rank';
import { displayDate, withBase } from '../lib/urls';
import type { Lineup } from '../lib/schema';

import { platformLabels } from '../lib/platforms';

export interface CollectionIndexCard {
  slug: string;
  name: string;
  season: string;
  archetype: string[];
  label: 'current' | 'fallback' | 'historical';
  search: string;
  date: string;
  dateKind: 'published' | 'season';
  dateText: string;
  video: boolean;
  index: number;
  roster: string;
  image: { src: string; srcset?: string; sizes?: string; width: number; height: number };
  videos: { url: string; platform: string; title: string }[];
  href: string;
}

// 只输出渲染卡片所需的字段：不含来源、攻略原话、技能、血脉与核验说明，
// 索引体积随阵容数线性增长但远小于卡片 DOM；详情数据仍由详情页服务端渲染。
function toIndexCard(
  lineup: Lineup,
  index: number,
  label: CollectionIndexCard['label'],
): CollectionIndexCard {
  const img = lineup.lineup_images[0];
  const updated = configurationDate(lineup);
  const sources = cardImageSources(img);
  return {
    slug: lineup.slug,
    name: lineup.name,
    season: lineup.season,
    archetype: lineup.archetype,
    label,
    search: [
      lineup.name,
      ...lineup.aliases,
      ...lineup.archetype,
      ...lineup.roster.map((p) => p.name),
    ]
      .join(' ')
      .toLowerCase(),
    date: updated,
    dateKind: updated ? 'published' : 'season',
    dateText: updated ? displayDate(updated) : lineup.season,
    video: lineup.tutorials.length > 0,
    index,
    roster: lineup.roster.map((p) => p.name).join(' · '),
    image: {
      src: sources.src,
      srcset: sources.srcset,
      sizes: sources.sizes,
      width: img.width,
      height: img.height,
    },
    videos: lineup.tutorials.map((t) => ({
      url: t.url,
      platform: platformLabels[t.platform],
      title: t.title,
    })),
    href: withBase(`/lineups/${lineup.slug}/`),
  };
}

export const GET: APIRoute = () => {
  const body = {
    active: activeLineups.map((lineup, i) =>
      toIndexCard(lineup, i, overview.fallback.includes(lineup) ? 'fallback' : 'current'),
    ),
    history: historyLineups.map((lineup, i) => toIndexCard(lineup, i, 'historical')),
  };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
