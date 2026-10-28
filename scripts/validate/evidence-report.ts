import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { allLineups } from '../../src/lib/data';
import { guardRefresh } from '../../src/lib/refresh';
import { lineupSchema } from '../../src/lib/schema';
import { imageInfo } from '../extract/image';
import { readChangeEvidence } from './change-evidence';
import { readLatestRunId } from '../research/io';

// Read-only maintenance report. It intentionally reports missing/ambiguous evidence
// without imposing new admission rules on existing records.
const shaOwners = new Map<string, { slug: string; url: string }[]>();
for (const lineup of allLineups)
  for (const image of lineup.lineup_images) {
    const owners = shaOwners.get(image.sha256) ?? [];
    owners.push({ slug: lineup.slug, url: image.source_page_url });
    shaOwners.set(image.sha256, owners);
  }

console.log('# 阵容证据治理报告');
console.log(`\n只读汇总：${allLineups.length} 套阵容。该报告不修改数据，也不阻挡既有记录。\n`);
for (const lineup of allLineups) {
  console.log(`## ${lineup.name} (${lineup.slug})`);
  console.log(
    `- 名称/别名/体系事实：${[lineup.name, ...lineup.aliases, ...lineup.archetype].join('；')}`,
  );
  console.log(
    `  对应来源：${lineup.sources.map((source) => `${source.type}「${source.title}」${source.url}（${source.published_at}）`).join('；')}`,
  );
  console.log(
    `- 赛季依据：${lineup.season} / ${lineup.version_label}；${lineup.verification_notes}`,
  );
  console.log(`- 赛季来源：${lineup.sources.map((source) => source.url).join('；')}`);
  console.log(
    `- 配置事实（成员/技能/血脉）：${lineup.roster.map((member) => `${member.name}（技能：${member.skills.join('、') || '未记录'}；血脉：${member.bloodline ?? '未记录'}）`).join('；')}`,
  );
  console.log(
    `  图片核验依据：${lineup.lineup_images.map((image) => `${image.verification_notes} [${image.source_page_url}]`).join('；')}`,
  );
  console.log(`- 其他事实摘要：${lineup.summary}`);
  for (const [i, image] of lineup.lineup_images.entries()) {
    const duplicate = (shaOwners.get(image.sha256) ?? []).filter(
      (owner) => owner.slug !== lineup.slug,
    );
    console.log(
      `- 原图 ${i + 1}：SHA ${image.sha256}；${image.width}×${image.height}；图源类型 ${image.source_kind}/${image.evidence_grade}；采集 ${image.captured_at}；署名 ${image.attribution}；原图 ${image.source_url}；来源页 ${image.source_page_url}`,
    );
    try {
      const measured = await imageInfo(await readFile(resolve('public', image.path.slice(1))));
      const mismatches = (['sha256', 'width', 'height'] as const).filter(
        (key) => measured[key] !== image[key],
      );
      if (mismatches.length) console.log(`  图片属性不匹配：${mismatches.join('、')}`);
    } catch (error) {
      console.log(`  图片读取/识别失败：${error instanceof Error ? error.message : String(error)}`);
    }
    if (duplicate.length)
      console.log(
        `  同 SHA 记录（转载关系需人工判读）：${duplicate.map((owner) => `${owner.slug} ${owner.url}`).join('；')}`,
      );
  }
  for (const guide of lineup.guides)
    console.log(
      `- 新事实·作者原话「${guide.quote}」：${guide.source_url}（${guide.author}，核验 ${guide.verified_at}）`,
    );
  for (const signal of lineup.signals)
    console.log(
      `- 新事实·公开记录「${signal.note}」：${signal.source_url}（${signal.observed_at}）`,
    );
  for (const tutorial of lineup.tutorials)
    console.log(
      `- 视频精确匹配依据：${tutorial.match_reason}；${tutorial.match_notes}；${tutorial.url}（${tutorial.verified_at}）`,
    );
  console.log();
}
console.log('refresh:guard 基线比较：');
try {
  const paths = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'data/lineups', 'data/archive'],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/)
    .filter((path) => path.endsWith('.json'));
  const previous = paths.map((path) =>
    lineupSchema.parse(
      JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' })),
    ),
  );
  const runId = await readLatestRunId();
  const evidence = await readChangeEvidence(runId);
  guardRefresh(previous, allLineups, evidence.accessibleUrls, evidence.evidence);
  console.log(`通过：HEAD 基线 ${previous.length} 套，当前 ${allLineups.length} 套。`);
} catch (error) {
  console.log(`需维护者复核：${error instanceof Error ? error.message : String(error)}`);
}
