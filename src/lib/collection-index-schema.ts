import { z } from 'zod';

// 与 collection-index.ts 生成的卡片同形。客户端只在 safeParse 通过后渲染，
// 避免把不可信 JSON 的数字或字符串直接拼进 HTML。
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, '只接受 HTTPS URL');
const sitePath = z.string().regex(/^\/(?!\/)\S+$/);

export const collectionIndexCardSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1),
    season: z.string().regex(/^S[1-9]\d*$/),
    archetype: z.array(z.string().trim().min(1)).min(1),
    label: z.enum(['current', 'fallback', 'historical']),
    search: z.string(),
    date: z.string(),
    dateKind: z.enum(['published', 'season']),
    dateText: z.string().trim().min(1),
    video: z.boolean(),
    index: z.number().int().nonnegative(),
    roster: z.string(),
    image: z
      .object({
        src: sitePath,
        srcset: z.string().trim().min(1).optional(),
        avifSrcset: z.string().trim().min(1).optional(),
        sizes: z.string().trim().min(1).optional(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
    videos: z
      .array(
        z
          .object({
            url: httpsUrl,
            platform: z.string().trim().min(1),
            title: z.string(),
          })
          .strict(),
      )
      .max(2),
    href: sitePath,
  })
  .strict();

export const collectionIndexSchema = z.array(collectionIndexCardSchema);
export type CollectionIndexCard = z.infer<typeof collectionIndexCardSchema>;
