// 默认仓库仅为本地开发兜底：未设置 GITHUB_REPOSITORY 时不中断构建；
// CI 与 GitHub Actions 环境下以 GITHUB_REPOSITORY 为准，不要依赖该默认值做线上判断。
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
