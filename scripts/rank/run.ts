import { mkdir,writeFile } from 'node:fs/promises';
import { allLineups,state } from '../../src/lib/data';
import { ranked,rankScore,selectActive } from '../../src/lib/rank';
const dir=`research/runs/${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})}`;
await mkdir(dir,{recursive:true});
const selected=selectActive(allLineups,state.season);
await writeFile(`${dir}/ranking.md`,`# 阵容梯度\n\n按强度梯度与资料分排序，不限制数量。评级注明来源/暂定/待定，跨赛季历史评级不套用于新版本。\n\n| 阵容 | 梯度 | 分数 | 状态 | 依据 |\n|---|---|---:|---|---|\n`+ranked(allLineups).map(l=>`| ${l.name} | ${l.tier}${l.tier_provisional?' 暂定':''} | ${rankScore(l)} | ${selected.includes(l)?'展示':l.status} | ${l.tier_reason} |`).join('\n')+'\n');
console.log(`排序报告：${dir}/ranking.md，展示 ${selected.length} 套。`);
