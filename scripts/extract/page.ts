import * as cheerio from 'cheerio';

export function extractPage(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const main = $('.news_warp_center, .newsct, .news_content, .news_warp_center_content, .news_warp_center .text, article, main').first();
  const content = main.length ? main : $('body');
  const images: { url: string; context: string; method: string; order: number }[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, context: string, method: string) => {
    if (!raw) return;
    try { const u = new URL(raw.replaceAll('\\/', '/'), pageUrl); if (u.protocol !== 'https:' || seen.has(u.href)) return;
      seen.add(u.href); images.push({url:u.href,context:context.trim().slice(0,500),method,order:images.length}); } catch { /* invalid URL */ }
  };
  // Inspect article media before navigation/sidebar media consumes a download budget.
  const media = [...content.find('img, source, a').toArray(), ...$('img, source, a').toArray()];
  for (const el of media) {
    const node = $(el); const context = `${node.attr('alt') || ''} ${node.parent().text()} ${node.parent().prev().text()}`;
    for (const attr of ['src','data-src','data-original','data-lazy-src','data-url','data-actualsrc']) {
      if (el.tagName !== 'a') add(node.attr(attr), context, attr);
    }
    for (const attr of ['srcset','data-srcset']) (node.attr(attr) || '').split(',').forEach(v => add(v.trim().split(/\s+/)[0],context,attr));
    if (/\.(png|jpe?g|webp|avif)(?:[?#]|$)/i.test(node.attr('href') || '')) add(node.attr('href'),context,'image-link');
  }
  $('meta[property="og:image"], meta[name="twitter:image"]').each((_,el) => add($(el).attr('content'),'metadata','og:image'));
  $('script').each((_, el) => {
    const raw = $(el).text();
    for (const m of raw.matchAll(/https?:[\\/]{2,4}[^\s"'<>]+?\.(?:png|jpe?g|webp|avif)(?:\?[^\s"'<>]*)?/gi)) add(m[0],'embedded JSON / script','embedded');
  });
  const videos = $('a[href]').toArray().map(e => ({url:$(e).attr('href') || '',title:$(e).text().trim()})).filter(v => /bilibili\.com\/video|douyin\.com\/video/.test(v.url));
  const related_links: { url: string; title: string }[] = [];
  $('a[href]').each((_, el) => {
    const title = $(el).text().trim();
    if (!/阵容|配队|队伍|一图流|PVP/i.test(title)) return;
    try {
      const u = new URL($(el).attr('href')!, pageUrl);
      if (u.protocol === 'https:' && !u.username && !u.password && !related_links.some(l => l.url === u.href))
        related_links.push({ url: u.href, title: title.slice(0, 200) });
    } catch { /* untrusted source links */ }
  });
  let ld: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => { try { ld.push(JSON.parse($(el).text())); } catch {} });
  const walk = (v: unknown, image = false): void => { if (typeof v === 'string' && image) add(v,'JSON-LD','json-ld');
    else if (Array.isArray(v)) v.forEach(x => walk(x,image)); else if (v && typeof v === 'object') Object.entries(v).forEach(([k,x]) => walk(x,image || ['image','thumbnailUrl','contentUrl'].includes(k))); };
  ld.forEach(v => walk(v));
  const text = content.clone().find('script, style, nav, form').remove().end().text().replace(/\s+/g,' ').trim();
  return { title:$('h1').first().text().trim() || $('title').text().trim(), text, images, videos, related_links,
    metadata: { author:$('meta[name="author"]').attr('content') || null, published_at:$('meta[property="article:published_time"]').attr('content') || null,
      description:$('meta[name="description"]').attr('content') || null },
    lineup_mentions:[...new Set(text.match(/[\u4e00-\u9fffA-Za-z0-9]{2,14}队/g) || [])],
    public_comments:$('[class*="comment"], [class*="reply"]').text().trim().slice(0,20000),
  };
}
