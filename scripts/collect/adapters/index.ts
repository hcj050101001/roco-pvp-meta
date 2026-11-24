import * as cheerio from 'cheerio';
import { extractPage } from '../../extract/page';

export type ExtractedPage = ReturnType<typeof extractPage>;

function parseJsonScript(html: string, marker: RegExp): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  for (const el of $('script').toArray()) {
    const text = $(el).text();
    const match = text.match(marker);
    if (!match?.[1]) continue;
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore malformed embedded state */
    }
  }
  return null;
}

function enrichBilibili(base: ExtractedPage, html: string): ExtractedPage {
  const state = parseJsonScript(html, /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (!state) return base;

  const videoData = state.videoData as
    | {
        bvid?: string;
        title?: string;
        desc?: string;
        pic?: string;
        pubdate?: number;
        owner?: { name?: string };
      }
    | undefined;

  if (!videoData) return base;

  const images = [...base.images];
  if (typeof videoData.pic === 'string') {
    const picUrl = videoData.pic.startsWith('//') ? `https:${videoData.pic}` : videoData.pic;
    if (picUrl.startsWith('https://') && !images.some((i) => i.url === picUrl)) {
      images.unshift({
        url: picUrl,
        context: `${videoData.title ?? ''} 视频封面`.trim(),
        method: 'bilibili-initial-state',
        order: -1,
      });
    }
  }

  const videos = [...base.videos];
  if (videoData.bvid) {
    const canonical = `https://www.bilibili.com/video/${videoData.bvid}`;
    if (!videos.some((v) => v.url.includes(videoData.bvid!))) {
      videos.unshift({ url: canonical, title: videoData.title || base.title });
    }
  }

  const published_at =
    base.metadata.published_at ||
    (typeof videoData.pubdate === 'number' && videoData.pubdate > 0
      ? new Date(videoData.pubdate * 1000).toISOString()
      : null);

  return {
    ...base,
    title: videoData.title || base.title,
    text: videoData.desc ? `${videoData.desc}\n${base.text}`.trim() : base.text,
    images,
    videos,
    metadata: {
      author: base.metadata.author || videoData.owner?.name || null,
      published_at,
      description: base.metadata.description || videoData.desc || null,
    },
  };
}

function enrichTapTap(base: ExtractedPage, html: string): ExtractedPage {
  const nextData =
    parseJsonScript(html, /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i) ??
    parseJsonScript(html, /^\s*(\{"props":[\s\S]*\})\s*$/);
  if (!nextData) return base;

  const $ = cheerio.load(html);
  const ogTime =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="publish-date"]').attr('content') ||
    null;

  return {
    ...base,
    metadata: {
      ...base.metadata,
      published_at: base.metadata.published_at || ogTime,
    },
  };
}

function enrichSocialMeta(
  base: ExtractedPage,
  html: string,
  pageUrl: string,
  platform: 'douyin' | 'xiaohongshu',
): ExtractedPage {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  const images = [...base.images];
  if (ogImage && ogImage.startsWith('https://') && !images.some((i) => i.url === ogImage)) {
    images.unshift({
      url: ogImage,
      context: `${ogTitle ?? base.title} 公开封面`.trim(),
      method: `${platform}-og-image`,
      order: -1,
    });
  }
  const videos = [...base.videos];
  if (platform === 'douyin' && /douyin\.com\/video\//.test(pageUrl)) {
    if (!videos.some((v) => v.url === pageUrl)) {
      videos.unshift({ url: pageUrl, title: ogTitle || base.title });
    }
  }
  return {
    ...base,
    title: ogTitle || base.title,
    images,
    videos,
    metadata: {
      ...base.metadata,
      description: base.metadata.description || ogDesc || null,
    },
  };
}

export function extractWithAdapter(
  html: string,
  pageUrl: string,
  platform: string | null,
): ExtractedPage {
  const base = extractPage(html, pageUrl);
  if (platform === 'bilibili') return enrichBilibili(base, html);
  if (platform === 'taptap') return enrichTapTap(base, html);
  if (platform === 'douyin' || platform === 'xiaohongshu') {
    return enrichSocialMeta(base, html, pageUrl, platform);
  }
  return base;
}
