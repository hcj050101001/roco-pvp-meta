import { PAGE_SIZE } from './collection-filter';
import { withBase } from './urls';

export function staticPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function staticPagePath(page: number, historical = false): string {
  const root = historical ? '/history/' : '/';
  return withBase(page <= 1 ? root : `${root}page/${page}/`);
}

export function additionalStaticPages(total: number): number[] {
  return Array.from({ length: staticPageCount(total) - 1 }, (_, i) => i + 2);
}
