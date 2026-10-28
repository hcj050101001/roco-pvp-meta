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

export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
}

export function isVisible(card: CollectionCard, state: CollectionState): boolean {
  const query = normalizeSearch(state.query);
  return (
    normalizeSearch(card.search).includes(query) &&
    (state.type === 'all' || card.types.includes(state.type)) &&
    (state.season === 'all' || card.season === state.season) &&
    (!state.video || card.video)
  );
}

export function sortCollection<T extends CollectionCard>(cards: T[], sort: string): T[] {
  return [...cards].sort((a, b) =>
    sort === 'recent' ? b.date.localeCompare(a.date) || a.index - b.index : a.index - b.index,
  );
}

/** 每页卡片数：首屏服务端渲染与客户端分页共用同一上限，DOM 不再随总数增长。 */
export const PAGE_SIZE = 24;

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

/**
 * 对已筛选排序后的卡片分页。页码钳制到 [1, totalPages]；
 * 空结果仍算 1 页（该页渲染空状态，而不是出现“第 1 / 0 页”）。
 */
export function paginate<T>(cards: T[], page: number, pageSize: number = PAGE_SIZE): Page<T> {
  const total = cards.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  return { items: cards.slice(start, start + pageSize), page: current, totalPages, total };
}
