import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { base, siteUrl } from './src/lib/site';

export default defineConfig({
  site: siteUrl,
  base,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    sitemap({ filter: (page) => !/\/(404|updates)\/?$/.test(new URL(page).pathname) }),
  ],
});
