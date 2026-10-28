import { z } from 'zod';

const text = z.string().trim().min(1);
const url = z.url().refine(v => new URL(v).protocol === 'https:', '只接受 HTTPS 来源');
const date = z.iso.datetime({ offset: true });
export const seasonIdSchema = z.string().regex(/^S[1-9]\d*$/, '赛季必须使用 S1、S2 等格式');
export const seasonSchema = z.object({
  id: seasonIdSchema, name: text, intro: text,
  theme: text.optional(), started_at: date.optional(), source_url: url.optional(),
}).strict();
export const seasonsSchema = z.array(seasonSchema).superRefine((seasons, ctx) => {
  if (new Set(seasons.map(s => s.id)).size !== seasons.length)
    ctx.addIssue({ code: 'custom', message: '赛季 ID 不能重复' });
});
export const siteStateSchema = z.looseObject({
  season: seasonIdSchema, version_label: text, theme: text.optional(),
  season_source: url.optional(), previous_season: seasonIdSchema.optional(),
  last_research_at: date.optional(), last_successful_update: date.optional(),
  balance_patch_date: date.nullable().optional(), season_checked_at: date.optional(),
  season_revision: z.number().int().positive().optional(), major_update_required: z.boolean().optional(),
  season_transitions: z.array(z.object({
    from: seasonIdSchema, to: seasonIdSchema, confirmed_at: date,
    source_url: url, kind: z.literal('major-season-update'),
  }).strict()).optional(), notice: text.optional(),
});
export const imageSchema = z.object({
  path: z.string().regex(/^\/assets\/lineups\/[a-z0-9/-]+\.(png|jpe?g|webp|avif)$/).refine(v => !v.includes('..')),
  source_url: url, source_page_url: url,
  source_kind: z.enum(['article', 'comment', 'video-frame', 'community-post']),
  capture_method: z.enum(['direct-image', 'browser-screenshot', 'video-frame']),
  published_at: date.nullable(), captured_at: date,
  width: z.number().int().min(300), height: z.number().int().min(200),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), phash: z.string().regex(/^[a-f0-9]{16}$/),
  evidence_grade: z.enum(['A', 'B', 'C']),
  verified: z.literal(true), verification_notes: text,
  attribution: text,
}).strict();
export const lineupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), slug: z.string().regex(/^[a-z0-9-]+$/),
  name: text, aliases: z.array(text), season: seasonIdSchema, version_label: text,
  archetype: z.array(text).min(1),
  summary: text,
  guides: z.array(z.object({ quote: text.max(24), author: text, source_url: url, published_at: date, verified_at: date }).strict()),
  signals: z.array(z.object({ kind: z.enum(['high-rank','engagement']), note: text, source_url: url, observed_at: date }).strict()),
  roster: z.array(z.object({ name: text, bloodline: text.nullable(), skills: z.array(text) }).strict()).length(6),
  lineup_images: z.array(imageSchema).min(1),
  tutorials: z.array(z.object({ title: text, url, platform: z.enum(['bilibili', 'douyin', 'other']), creator: text,
    published_at: date, match_reason: z.enum(['exact-title', 'same-six', 'same-author', 'source-linked']), match_notes: text,
    verified_at: date }).strict()).max(2),
  sources: z.array(z.object({ url, type: z.enum(['primary', 'mirror', 'community', 'index']), title: text,
    published_at: date, updated_at: date.optional(), last_checked_at: date }).strict()).min(1).max(3),
  first_seen_at: date, last_verified_at: date, status: z.enum(['active', 'stale', 'archived']),
  verification_notes: text, archive_reason: text.nullable(),
  player_notes: z.array(text).default([]),
}).strict().superRefine((lineup, ctx) => {
  if (new Set(lineup.roster.map(p => p.name)).size !== 6) ctx.addIssue({ code: 'custom', message: '成员不能重复' });
  for (const item of [...lineup.guides,...lineup.signals]) {
    if (!lineup.sources.some(s=>s.url===item.source_url)) ctx.addIssue({code:'custom',message:'原话和排序线索必须关联已记录来源'});
  }
  if (lineup.status === 'archived' && !lineup.archive_reason) ctx.addIssue({ code: 'custom', message: '归档需要理由' });
  if (lineup.lineup_images.every(i => i.evidence_grade === 'C') && new Set(lineup.sources.map(s => new URL(s.url).hostname)).size < 2)
    ctx.addIssue({ code: 'custom', message: 'C 级图片需要独立来源交叉验证' });
  if (lineup.lineup_images.some(i => !lineup.sources.some(s => s.url === i.source_page_url)))
    ctx.addIssue({ code: 'custom', message: '图片必须关联已记录的来源页' });
  if (Date.parse(lineup.first_seen_at) > Date.parse(lineup.last_verified_at)) ctx.addIssue({ code: 'custom', message: '验证时间不能早于发现时间' });
});
export type Lineup = z.infer<typeof lineupSchema>;
