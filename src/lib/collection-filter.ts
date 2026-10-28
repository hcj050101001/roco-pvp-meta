import type { CollectionState } from './collection-state';

export interface CollectionCard {
  search: string;
  types: string[];
  season: string;
  video: boolean;
  date: string;
  index: number;
  title: string;
}

export function isVisible(card: CollectionCard, state: CollectionState): boolean {
  const query = state.query.trim().toLowerCase();
  return card.search.includes(query)
    && (state.type === 'all' || card.types.includes(state.type))
    && (state.season === 'all' || card.season === state.season)
    && (!state.video || card.video);
}

export function sortCollection<T extends CollectionCard>(cards: T[], sort: string): T[] {
  return [...cards].sort((a, b) => sort === 'recent'
    ? b.date.localeCompare(a.date) || a.index - b.index
    : sort === 'name'
      ? a.title.localeCompare(b.title, 'zh-CN')
      : a.index - b.index);
}
