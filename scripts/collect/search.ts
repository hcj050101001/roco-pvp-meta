import { publicFetch } from './network';
import { type Query } from './strategy';
import { bingProvider, allowedSource, searchTarget, ingestSearch } from './providers/bing';
import { searxngProvider } from './providers/searxng';
import { bilibiliProvider } from './providers/bilibili';
import { tiebaProvider } from './providers/tieba';
import { so360Provider } from './providers/so360';
import { sogouProvider } from './providers/sogou';
import type { SearchHealth, SearchProvider, SearchRecord } from './providers/types';

export { allowedSource, searchTarget, ingestSearch };

export const baseProviders: SearchProvider[] = [searxngProvider, bilibiliProvider, bingProvider];

export const fullProviders: SearchProvider[] = [
  searxngProvider,
  bilibiliProvider,
  tiebaProvider,
  bingProvider,
  so360Provider,
  sogouProvider,
];

export async function discover(
  queries: Query[],
  save: (name: string, body: Buffer) => Promise<void>,
  fetcher = publicFetch,
  providers: SearchProvider[] = fetcher === publicFetch ? fullProviders : baseProviders,
) {
  const records: SearchRecord[] = [];
  const health: SearchHealth[] = [];

  for (let start = 0; start < queries.length; start += 3) {
    await Promise.all(
      queries.slice(start, start + 3).map(async (query, offset) => {
        const queryIndex = start + offset;
        const ctx = { queryIndex, fetcher, save };
        let gotSearxngResults = false;

        for (const provider of providers) {
          if (!provider.supports(query)) continue;
          if (['bing', 'so360', 'sogou'].includes(provider.id) && gotSearxngResults) {
            continue;
          }

          const res = await provider.search(query, ctx);
          health.push(...res.health);
          records.push(...res.records);

          if (provider.id === 'searxng' && res.records.length > 0) {
            gotSearxngResults = true;
          }
        }
      }),
    );
  }

  return { urls: [...new Set(records.map((r) => r.url))], records, health };
}
