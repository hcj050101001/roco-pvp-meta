import { test,expect } from '@playwright/test';
import { activeLineups } from '../../src/lib/data';
test('总览搜索、组合筛选与重置正常',async({page})=>{
  await page.goto('./'); await expect(page).toHaveTitle(/阵容图鉴/);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.length);
  const query=activeLineups[0].roster[0].name;
  await page.getByRole('searchbox').fill(query); await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>[l.name,...l.aliases,...l.archetype,...l.roster.map(p=>p.name)].join(' ').includes(query)).length);
  await page.getByRole('searchbox').fill('no-such-lineup-xxxx'); await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await expect(page.getByText('还没有找到这套配队')).toBeVisible();
  await page.getByRole('button',{name:'重置筛选'}).click(); await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.length);
  const filter=activeLineups[0].archetype[0];await page.getByRole('button',{name:filter,exact:true}).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>l.archetype.includes(filter)).length);
  await page.selectOption('#sort','recent');
  expect(await page.locator('[data-card]').first().getAttribute('data-date')).toBe(activeLineups.map(l=>l.lineup_images[0].published_at).sort().at(-1));
});
test('全部详情、原图和双返回可用，无裁图或横向溢出',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.screenshot({path:`artifacts/home-${info.project.name}.png`,fullPage:true});
  const links=await page.locator('[data-card] a').evaluateAll(els=>els.map(e=>(e as HTMLAnchorElement).href));
  for(const url of links){
    await page.goto(url); await expect(page.getByRole('link',{name:'← 返回阵容总览',exact:true})).toHaveCount(2);
    const images=await page.locator('img').evaluateAll(els=>els.map(el=>{const e=el as HTMLImageElement;return {loaded:e.complete&&e.naturalWidth>0,fit:getComputedStyle(e).objectFit,ratio:e.getBoundingClientRect().width/e.getBoundingClientRect().height,natural:e.naturalWidth/e.naturalHeight};}));
    for(const img of images){expect(img.loaded).toBe(true);expect(img.fit).toBe('contain');expect(Math.abs(img.ratio-img.natural)).toBeLessThan(.01);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:`artifacts/detail-${info.project.name}.png`,fullPage:true});
  await page.getByRole('link',{name:'← 返回阵容总览',exact:true}).last().click(); await expect(page.locator('#lineup-overview')).toBeVisible();
  expect(errors).toEqual([]);
});
test('导航与收录准则可访问',async({page})=>{
  await page.goto('./'); await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'收录准则'}).click();
  await expect(page.locator('h1')).toContainText('有图、有据');
  await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'更新记录'}).click();
  await expect(page.locator('.update-entry li')).toHaveCount(activeLineups.length);
});
