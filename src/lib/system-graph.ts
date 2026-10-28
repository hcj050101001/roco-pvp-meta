import type { Lineup } from './schema';

export interface SystemEdge {
  first: string;
  second: string;
  lineups: { slug: string; name: string }[];
}

export function systemGraph(lineups: Lineup[]) {
  const systems = new Set<string>();
  const edges = new Map<string, SystemEdge>();
  for (const lineup of lineups) {
    if (!lineup.lineup_images.some((image) => image.verified)) continue;
    const tags = [...new Set(lineup.archetype)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    tags.forEach((tag) => systems.add(tag));
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = JSON.stringify([tags[i], tags[j]]);
        const edge = edges.get(key) ?? { first: tags[i], second: tags[j], lineups: [] };
        edge.lineups.push({ slug: lineup.slug, name: lineup.name });
        edges.set(key, edge);
      }
    }
  }
  return {
    systems: [...systems].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    edges: [...edges.values()].sort(
      (a, b) =>
        a.first.localeCompare(b.first, 'zh-CN') || a.second.localeCompare(b.second, 'zh-CN'),
    ),
  };
}
