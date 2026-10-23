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
export const projectBasePath = repoName === `${owner}.github.io` ? '' : `/${repoName}`;

// 本地开发默认站点根；CI 的项目页自动带仓库子路径；SITE_BASE 可显式覆盖。
export const basePath = normalizeBase(
  process.env.SITE_BASE ?? (process.env.GITHUB_ACTIONS ? projectBasePath : ''),
);
export const base = basePath || '/';
export const siteUrl = (process.env.SITE_URL || `https://${owner}.github.io`).replace(/\/+$/, '');

/** 将已在站点 base 下的路径解析为完整地址。 */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteUrl}/`).href;
}
