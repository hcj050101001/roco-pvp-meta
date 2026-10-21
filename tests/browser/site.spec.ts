import { test,expect } from '@playwright/test';
import { activeLineups,allLineups,historyLineups,currentSeason,overview } from '../../src/lib/data';

test('玩家首页：星月主题、梯度与体系交叉筛选',async({page})=>{
  await page.goto('./');await expect(page).toHaveTitle(/阵容图鉴/);
  await expect(page.locator('body')).toHaveAttribute('data-theme',currentSeason.theme);
  await expect(page.getByRole('link',{name:'收录准则',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'更新记录',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.length);
  const query=activeLineups[0].roster[0].name;
  await page.getByRole('searchbox').fill(query);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>[l.name,...l.aliases,...l.archetype,...l.roster.map(p=>p.name)].join(' ').includes(query)).length);
  await page.getByRole('searchbox').fill('no-such-lineup-xxxx');await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await expect(page.getByText('还没有找到这套配队')).toBeVisible();
  await page.getByRole('button',{name:'重置筛选'}).click();
  const tierButton=page.locator('[data-tier-filter]').nth(1),tier=await tierButton.getAttribute('data-tier-filter');await tierButton.click();
  const expected=tier==='过渡'?overview.fallback:activeLineups.filter(l=>l.tier===tier&&!overview.fallback.includes(l));
  await expect(page.locator('[data-card]:visible')).toHaveCount(expected.length);
  const type=expected[0].archetype[0];await page.locator('[data-filter]').filter({hasText:type}).first().click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(expected.filter(l=>l.archetype.includes(type)).length);
  await page.selectOption('#sort','recent');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('当季和往期详情均可返回，完整原图无裁切',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  for(const img of await page.locator('img').all()) {
    await img.scrollIntoViewIfNeeded();await expect(img).toHaveJSProperty('complete',true);
    expect(await img.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`artifacts/home-${info.project.name}.png`,fullPage:true});
  await page.screenshot({path:`artifacts/home-viewport-${info.project.name}.png`});
  for(const lineup of allLineups){
    const response=await page.goto(`lineups/${lineup.slug}/`);expect(response?.status()).toBe(200);
    await expect(page.locator('.detail-nav-inner>a')).toHaveText(/返回阵容总览|返回往期阵容/);
    const images=await page.locator('img').evaluateAll(els=>els.map(el=>{const e=el as HTMLImageElement;return {loaded:e.complete&&e.naturalWidth>0,fit:getComputedStyle(e).objectFit,ratio:e.getBoundingClientRect().width/e.getBoundingClientRect().height,natural:e.naturalWidth/e.naturalHeight};}));
    for(const img of images){expect(img.loaded).toBe(true);expect(img.fit).toBe('contain');expect(Math.abs(img.ratio-img.natural)).toBeLessThan(.01);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:`artifacts/detail-${info.project.name}.png`,fullPage:true});
  await page.locator('.bottom-return').click();await expect(page).toHaveTitle(/往期阵容/);
  expect(errors).toEqual([]);
});

test('往期赛季、搜索与历史梯度组合，旧链接跳转正确',async({page})=>{
  await page.goto('./');await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'往期阵容'}).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  const season=historyLineups[0].season;await page.locator(`[data-season-filter="${season}"]`).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.filter(l=>l.season===season).length);
  await page.getByRole('searchbox').fill('no-such-lineup');await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await page.getByRole('button',{name:'重置筛选'}).click();await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  await page.goto('updates/');await expect(page).toHaveURL(/history/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
