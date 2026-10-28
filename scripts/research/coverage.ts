import policy from '../../data/research-policy.json';
import { platformFor } from '../collect/strategy';
import type { Lineup } from '../../src/lib/schema';

type Record = {
  url: string;
  status: string;
  seasons?: string[];
  images?: { sha256?: string; error?: string }[];
  deferred_images?: unknown[];
  pending_image_urls?: string[];
  browser_error?: string;
};
export type Manifest = {
  run_id: string;
  target_seasons?: string[];
  sources: Record[];
  search_health?: { season?: string; platform?: string; status: string }[];
  deferred_sources?: { pending_image_urls?: string[] }[];
};
export function coverage(manifest: Manifest, lineups: Lineup[]) {
  const publishedHashes = new Set(lineups.flatMap((l) => l.lineup_images.map((i) => i.sha256)));
  const rows = policy.platforms.map((p) => {
    const sources = manifest.sources.filter((s) => platformFor(s.url) === p.id);
    const ok = sources.filter((s) => s.status === 'ok');
    const images = ok.flatMap((s) => (s.images ?? []).filter((i) => i.sha256 && !i.error));
    const hashes = [...new Set(images.map((i) => i.sha256!))];
    return {
      platform: p.id,
      kind: p.kind,
      attempted: sources.length,
      fetched: ok.length,
      browser_failures: ok.filter((s) => s.browser_error).length,
      image_sources: ok.filter((s) => s.images?.some((i) => i.sha256 && !i.error)).length,
      unique_images: hashes.length,
      unpublished_images: hashes.filter((h) => !publishedHashes.has(h)).length,
      deferred_images: sources.reduce(
        (n, s) => n + (s.deferred_images?.length ?? 0) + (s.pending_image_urls?.length ?? 0),
        0,
      ),
    };
  });
  const successful = rows.filter((r) => r.image_sources > 0).length;
  const seasons = (manifest.target_seasons ?? []).map((season) => ({
    season,
    // Search scope is not semantic verification of a page or image's season.
    queries_attempted: (manifest.search_health ?? []).filter((s) => s.season === season).length,
    supported_search_results: (manifest.search_health ?? []).filter(
      (s) => s.season === season && s.status === 'ok',
    ).length,
    scoped_pages_attempted: manifest.sources.filter((s) => s.seasons?.includes(season)).length,
    published_lineups: lineups.filter((l) => l.season === season).length,
    published_source_platforms: [
      ...new Set(
        lineups
          .filter((l) => l.season === season)
          .flatMap((l) => l.sources.map((s) => platformFor(s.url) ?? new URL(s.url).hostname)),
      ),
    ].sort(),
  }));
  const published = policy.platforms.map((p) => ({
    platform: p.id,
    lineups: lineups.filter((l) => l.sources.some((s) => platformFor(s.url) === p.id)).length,
    unique_source_pages: new Set(
      lineups.flatMap((l) =>
        l.sources.filter((s) => platformFor(s.url) === p.id).map((s) => s.url),
      ),
    ).size,
  }));
  return {
    run_id: manifest.run_id,
    status:
      successful === 0
        ? 'no-image-evidence'
        : successful < policy.minimum_successful_platforms
          ? 'limited-source-coverage'
          : 'multi-platform-candidates',
    target_successful_platforms: policy.minimum_successful_platforms,
    successful_image_platforms: successful,
    platforms: rows,
    seasons,
    published,
    deferred_sources: manifest.deferred_sources?.length ?? 0,
    note: '平台数、图片哈希与查询赛季均不证明独立原创或图片语义；转载链、作者、六只成员和真实赛季仍须逐项核验。覆盖目标只用于发现诊断，不是发布数量配额。',
  };
}
