import { mkdir,writeFile } from 'node:fs/promises';
import { allLineups,state } from '../../src/lib/data';
import { ranked,signalPriority,configurationDate,selectActive } from '../../src/lib/rank';
const dir=`research/runs/${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})}`;
await mkdir(dir,{recursive:true});
const selected=selectActive(allLineups,state.season);
await writeFile(`${dir}/ranking.md`,`# 阵容推荐顺序\n\n不评强度、不虚构热度。优先近期有公开实绩/热度记录的队伍，再按配置发布日期排序；45天前的线索不再优先。索引更新和复核日期不冒充配置日期。\n\n| 阵容 | 有效线索优先级 | 配置日期 | 状态 | 来源记录 |\n|---|---:|---|---|---|\n`+ranked(allLineups).map(l=>`| ${l.name} | ${signalPriority(l)} | ${configurationDate(l)||'未知'} | ${selected.includes(l)?'展示':l.status} | ${l.signals.map(s=>s.note).join('；')||'无独立量化热度'} |`).join('\n')+'\n');
console.log(`排序报告：${dir}/ranking.md，展示 ${selected.length} 套。`);
