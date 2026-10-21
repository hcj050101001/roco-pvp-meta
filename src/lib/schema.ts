import { z } from 'zod';

const text = z.string().trim().min(1);
const url = z.url().refine(v => new URL(v).protocol === 'https:', '只接受 HTTPS 来源');
const date = z.iso.datetime({ offset: true });
const score = z.number().min(0).max(100);
export const imageSchema = z.object({
  path: z.string().regex(/^\/assets\/lineups\/[a-z0-9/-]+\.(png|jpe?g|webp|avif)$/).refine(v => !v.includes('..')),
  source_url: url, source_page_url: url,
  source_kind: z.enum(['article', 'comment', 'video-frame', 'community-post']),
  capture_method: z.enum(['direct-image', 'browser-screenshot', 'video-frame']),
  published_at: date, captured_at: date,
  width: z.number().int().min(300), height: z.number().int().min(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), phash: z.string().regex(/^[a-f0-9]{16}$/),
  evidence_grade: z.enum(['A', 'B', 'C']),
  verified: z.literal(true), verification_notes: text,
  attribution: text,
}).strict();
export const lineupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), slug: z.string().regex(/^[a-z0-9-]+$/),
  name: text, aliases: z.array(text), season: text, version_label: text,
  tier: z.enum(['T0-S', 'T0', 'T0.5', 'T1', '高热', '科研', '反制']), tier_reason: text,
  archetype: z.array(text).min(1),
  strength_score: score, popularity_score: score, evidence_score: score, recency_score: score,
  score_notes: text, summary: text, analysis: text,
  recommended_lead: text, lead_notes: text, lead_basis: z.enum(['source', 'inferred', 'unknown']),
  core_plan: z.array(text).min(1), weaknesses: z.array(text).min(1), matchup_notes: z.array(text),
  roster: z.array(z.object({ name: text, role: text, bloodline: text.nullable(), skills: z.array(text), notes: text }).strict()).length(6),
  lineup_images: z.array(imageSchema).min(1),
  tutorials: z.array(z.object({ title: text, url, platform: z.enum(['bilibili', 'douyin', 'other']), creator: text,
    published_at: date, match_reason: z.enum(['exact-title', 'same-six', 'same-author', 'source-linked']), match_notes: text,
    verified_at: date }).strict()).max(2),
  sources: z.array(z.object({ url, type: z.enum(['primary', 'mirror', 'community', 'index']), title: text,
    published_at: date, last_checked_at: date }).strict()).min(1).max(3),
  first_seen_at: date, last_verified_at: date, status: z.enum(['active', 'stale', 'archived']),
  verification_notes: text, archive_reason: text.nullable(),
}).strict().superRefine((lineup, ctx) => {
  if (new Set(lineup.roster.map(p => p.name)).size !== 6) ctx.addIssue({ code: 'custom', message: '成员不能重复' });
  if (lineup.status === 'archived' && !lineup.archive_reason) ctx.addIssue({ code: 'custom', message: '归档需要理由' });
  if (lineup.lineup_images.every(i => i.evidence_grade === 'C') && new Set(lineup.sources.map(s => new URL(s.url).hostname)).size < 2)
    ctx.addIssue({ code: 'custom', message: 'C 级图片需要独立来源交叉验证' });
  if (lineup.lineup_images.some(i => !lineup.sources.some(s => s.url === i.source_page_url)))
    ctx.addIssue({ code: 'custom', message: '图片必须关联已记录的来源页' });
  if (Date.parse(lineup.first_seen_at) > Date.parse(lineup.last_verified_at)) ctx.addIssue({ code: 'custom', message: '验证时间不能早于发现时间' });
});
export type Lineup = z.infer<typeof lineupSchema>;
