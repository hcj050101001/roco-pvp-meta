import type { publicFetch } from '../network';
import type { Query } from '../strategy';

export type SearchRecord = {
  url: string;
  season: string;
  query: string;
  published_at?: string;
  provider?: string;
};

export type SearchHealth = {
  query: string;
  season: string;
  platform: string;
  provider: string;
  status: string;
  results: number;
  error?: string;
};

export type SearchContext = {
  queryIndex: number;
  fetcher: typeof publicFetch;
  save: (name: string, body: Buffer) => Promise<void>;
};

export interface SearchProvider {
  readonly id: string;
  supports(query: Query): boolean;
  search(
    query: Query,
    ctx: SearchContext,
  ): Promise<{ records: SearchRecord[]; health: SearchHealth[] }>;
}
