import { promoteContent } from './promotion';

const count = await promoteContent();
console.log(`已应用 ${count} 条候选资料，既有 ID 和旧图片均保留。`);
