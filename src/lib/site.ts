// 自有服务器优先使用 SITE_URL 与 SITE_BASE（默认站点根 /）；
// 仅在 GitHub Actions 且未显式覆盖时，自动推导 GitHub Pages 仓库子路径。
try {
  process.loadEnvFile?.();
} catch {
  /* .env 不存在时忽略 */
}
const DEFAULT_REPOSITORY = 'hcj050101001/roco-pvp-meta';
const repositoryPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export interface RepositoryParts {
  repository: string;
  owner: string;
  repoName: string;
}

export function parseRepository(value: string | undefined): RepositoryParts {
  const repository = value || DEFAULT_REPOSITORY;
  if (!repositoryPattern.test(repository)) throw Error('无效仓库名');
  const [owner, repoName] = repository.split('/');
  return { repository, owner, repoName };
}

/** 统一站点根路径：去掉首尾斜杠后重新加一个前导斜杠；站点根返回空串。 */
export function normalizeBase(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

export const { repository, owner, repoName } = parseRepository(process.env.GITHUB_REPOSITORY);

/** 由 owner/repoName 推导项目页 base：用户页仓库（*.github.io）无子路径，其余为 /<仓库名>。 */
export function projectBasePathFor(ownerName: string, repoNameValue: string): string {
  return repoNameValue === `${ownerName}.github.io` ? '' : `/${repoNameValue}`;
}
export const projectBasePath = projectBasePathFor(owner, repoName);

export const deploymentTarget: 'github-pages' | 'server' =
  process.env.GITHUB_ACTIONS && !process.env.SITE_URL ? 'github-pages' : 'server';

// 自有服务器默认站点根 ''；CI 的 GitHub Pages 项目页自动带仓库子路径；SITE_BASE 可显式覆盖。
export const basePath = normalizeBase(
  process.env.SITE_BASE ?? (deploymentTarget === 'github-pages' ? projectBasePath : ''),
);
export const base = basePath || '/';
export const siteUrl = (
  process.env.SITE_URL ||
  (deploymentTarget === 'github-pages' ? `https://${owner}.github.io` : 'http://127.0.0.1:4321')
).replace(/\/+$/, '');

/** 将已在站点 base 下的路径解析为完整地址。 */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteUrl}/`).href;
}
