import { readFile, writeFile } from 'node:fs/promises';
import { parseLedger, recordDecisions } from './ledger';
import { execFileSync } from 'node:child_process';
const { run_id } = JSON.parse(await readFile('research/inbox/latest.json', 'utf8'));
if (!/^[a-zA-Z0-9-]+$/.test(run_id)) throw Error('无效研究路径');
const index = JSON.parse(await readFile(`research/inbox/${run_id}/vision/index.json`, 'utf8'));
let decisions: unknown = [];
try { decisions = JSON.parse(await readFile(`research/runs/${run_id}/decisions.json`, 'utf8')); }
catch (e: any) { if (e.code !== 'ENOENT') throw e; }
const path = 'research/candidates/image-ledger.json';
// Model artifacts cannot rewrite the prior decision history.
const tracked=execFileSync('git',['ls-tree','--name-only','HEAD','--',path],{encoding:'utf8'}).trim();
const previous=tracked?parseLedger(JSON.parse(execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}))):{};
const ledger = recordDecisions(previous, index.candidates, decisions);
await writeFile(path, JSON.stringify(ledger, null, 2) + '\n');
console.log(`候选决定已保存：${Object.keys(ledger).length} 个跨轮记录。`);
