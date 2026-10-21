import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY || 'hcj050101001/roco-pvp-meta';
const [owner, name] = repository.split('/');
const base = process.env.SITE_BASE ?? (process.env.GITHUB_ACTIONS && name !== `${owner}.github.io` ? `/${name}` : '/');
export default defineConfig({
  site: process.env.SITE_URL || `https://${owner}.github.io`,
  base,
  output: 'static',
  trailingSlash: 'always',
});
