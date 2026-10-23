import type { APIRoute } from 'astro';

// GitHub Pages 项目站点只能从域名根目录读取 robots.txt，此文件为将来绑定自定义域名预留。
export const GET: APIRoute = () => {
  const sitemap = new URL(`${import.meta.env.BASE_URL}sitemap-index.xml`, import.meta.env.SITE);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
