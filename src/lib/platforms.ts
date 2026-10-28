import type { Lineup } from './schema';

/** 教学视频平台类型，与阵容 schema 中的 platform 枚举保持一致。 */
export type TutorialPlatform = Lineup['tutorials'][number]['platform'];

/** 教学视频平台中文名，卡片与详情页共用。 */
export const platformLabels: Record<TutorialPlatform, string> = {
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  other: '视频',
};
