import { writeFile } from 'node:fs/promises';
import { allLineups, state, seasons } from '../../src/lib/data';
import { siteSignature } from '../../src/lib/publish';
// schema 2：指纹算法变更——siteSignature 改为纯内容指纹，不再混入随时间衰减的
// 信号优先级。线上旧的 schema 1 指纹与新指纹必然不同，publish-plan 在本次变更后
// 的第一次比对会因此报告 publish=true 一次（预期内的一次性迁移，不是内容变化）。
await writeFile('dist/build-state.json', JSON.stringify({ schema:2, signature:siteSignature(allLineups,state,seasons) })+'\n');
