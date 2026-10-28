import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import { readLineups } from '../../src/lib/data';
import { coverage } from './coverage';
import { readLatestManifest } from './io';
const { runId: run_id, manifest: rawManifest } = await readLatestManifest('research/inbox');
if (!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效研究路径');
if (rawManifest.run_id !== run_id) throw Error('研究运行 ID 不匹配');
// io.ts preserves the producer's browser_error: null on success, while
// coverage()'s source type predates that and only accepts a string. Null and
// undefined are both falsy for coverage()'s browser-error check, so normalise
// here instead of weakening io validation or touching coverage.ts.
const manifest = { ...rawManifest, sources: rawManifest.sources.map(s => ({ ...s, browser_error: s.browser_error ?? undefined })) };
const report = coverage(manifest, readLineups());
const root = `research/runs/${run_id}`;
await mkdir(root, { recursive: true });
await writeFile(`${root}/coverage.json`, JSON.stringify(report, null, 2) + '\n');
const lines = [`# 来源与赛季覆盖：${run_id}`, '', `状态：${report.status}；有候选图的平台 ${report.successful_image_platforms}/${report.target_successful_platforms}（发现目标）。`, '',
  '| 平台 | 请求页 | 成功页 | 有图页 | 唯一图 | 未收录哈希 | 待续图片 |', '|---|---:|---:|---:|---:|---:|---:|',
  ...report.platforms.map(p => `| ${p.platform} | ${p.attempted} | ${p.fetched} | ${p.image_sources} | ${p.unique_images} | ${p.unpublished_images} | ${p.deferred_images} |`), '',
  '| 查询赛季 | 搜索尝试 | 有支持结果 | 目标页尝试 | 已收录队伍 | 已收录来源平台 |', '|---|---:|---:|---:|---:|---|',
  ...report.seasons.map(s => `| ${s.season} | ${s.queries_attempted} | ${s.supported_search_results} | ${s.scoped_pages_attempted} | ${s.published_lineups} | ${s.published_source_platforms.join(', ')} |`), '',
  `待续查来源：${report.deferred_sources}。`, '', report.note, ''];
await writeFile(`${root}/coverage.md`, lines.join('\n'));
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
if (report.status !== 'multi-platform-candidates') console.warn('来源覆盖仍不足：必须在研究摘要说明缺口；不得宣称已实现广泛来源或降低图片核验门槛。');
