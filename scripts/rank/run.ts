import { mkdir,writeFile } from 'node:fs/promises';
import { allLineups,state } from '../../src/lib/data';
import { ranked,rankScore,selectActive } from '../../src/lib/rank';
const dir=`research/runs/${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})}`;
await mkdir(dir,{recursive:true});
const selected=selectActive(allLineups,state.season);
await writeFile(`${dir}/ranking.md`,`# 阵容资料排序\n\n权重：实绩 35%、新鲜度 25%、热度 20%、证据 20%。分数为编辑资料分，不是胜率。每体系优先最多两套，总数最多十套。\n\n| 阵容 | 分数 | 状态 | 依据 |\n|---|---:|---|---|\n`+ranked(allLineups).map(l=>`| ${l.name} | ${rankScore(l)} | ${selected.includes(l)?'展示':l.status} | ${l.score_notes} |`).join('\n')+'\n');
console.log(`排序报告：${dir}/ranking.md，展示 ${selected.length} 套。`);
