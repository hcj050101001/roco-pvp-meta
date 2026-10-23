import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const repository = process.env.GITHUB_REPOSITORY || 'hcj050101001/roco-pvp-meta';
const [owner, name] = repository.split('/');
const base = process.env.SITE_BASE ?? (process.env.GITHUB_ACTIONS && name !== `${owner}.github.io` ? `/${name}` : '/');
export default defineConfig({
  site: process.env.SITE_URL || `https://${owner}.github.io`,
  base,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: page => !/\/(404|updates)\/?$/.test(new URL(page).pathname) })],
});
