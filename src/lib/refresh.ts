import type { Lineup } from './schema';

export interface ChangeEvidence {
  lineup_id: string;
  fields: string[];
  source_url: string;
  artifact_sha256: string;
  reason: string;
}

// Verification timestamps and prose are not new configuration evidence.
function content(lineup: Lineup) {
  const { last_verified_at, verification_notes, ...rest } = lineup;
  return {
    ...rest,
    sources: lineup.sources.map(({ last_checked_at, ...source }) => source),
    lineup_images: lineup.lineup_images.map(({ captured_at, verification_notes, ...image }) => image),
    guides: lineup.guides.map(({ verified_at, ...guide }) => guide),
    tutorials: lineup.tutorials.map(({ verified_at, ...tutorial }) => tutorial),
  };
}

export function guardRefresh(previous: Lineup[], current: Lineup[], accessibleUrls: string[], evidence: ChangeEvidence[] = []) {
  for (const old of previous) {
    const next = current.find(l => l.id === old.id);
    if (!next) throw Error(`不允许硬删除既有阵容：${old.name}`);
    if (old.slug !== next.slug) throw Error(`不允许更改既有详情地址：${old.name}`);
    if (JSON.stringify(old.roster.map(p => p.name)) !== JSON.stringify(next.roster.map(p => p.name)))
      throw Error(`自动更新不允许改写既有成员名称：${old.name}；请将名称修订留在候选记录中`);
    if (old.status !== 'archived' && next.status === 'archived' && !next.archive_reason) throw Error('归档缺少理由');
  }
  for (const next of current) {
    const old = previous.find(l => l.id === next.id);
    if (old && JSON.stringify(old) === JSON.stringify(next)) continue;
    if (!accessibleUrls.some(url => next.sources.some(s => s.url === url))) throw Error(`来源均失败时不允许更改：${next.name}`);
    const before: Record<string, unknown> = old ? content(old) : {};
    const after: Record<string, unknown> = content(next);
    const fields = Object.keys(after).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (!fields.length) throw Error(`无新证据不得刷新日期或核验说明：${next.name}`);
    for (const field of fields) {
      if (!evidence.some(e => e.lineup_id === next.id && e.fields.includes(field) && e.reason.trim() &&
        accessibleUrls.includes(e.source_url) && next.sources.some(s => s.url === e.source_url)))
        throw Error(`变更缺少本轮来源证据：${next.name}.${field}`);
    }
  }
  if (previous.some(l => l.status === 'active') && !current.some(l => l.status === 'active')) throw Error('不允许空结果替换生产');
}
