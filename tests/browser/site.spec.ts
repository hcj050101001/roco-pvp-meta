import { test,expect } from '@playwright/test';
import { activeLineups,allLineups,historyLineups } from '../../src/lib/data';
import { mkdir } from 'node:fs/promises';

test('玩家首页：固定明亮风格、体系筛选与全局排序',async({page})=>{
  await page.goto('./');await expect(page).toHaveTitle(/阵容图鉴/);
  await expect(page.locator('body')).toHaveAttribute('data-theme','light');
  await expect(page.getByRole('link',{name:'收录准则',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'更新记录',exact:true})).toHaveCount(0);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.length);
  const query=activeLineups[0].roster[0].name;
  await page.getByRole('searchbox').fill(query);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>[l.name,...l.aliases,...l.archetype,...l.roster.map(p=>p.name)].join(' ').includes(query)).length);
  await page.getByRole('searchbox').fill('no-such-lineup-xxxx');await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await expect(page.getByText('没有找到符合条件的阵容')).toBeVisible();
  await expect(page.getByRole('link',{name:'浏览往期阵容'})).toBeVisible();
  await page.getByRole('button',{name:'重置筛选'}).click();
  await expect(page.locator('[data-tier-filter],.tier')).toHaveCount(0);
  const type=activeLineups[0].archetype[0];await page.locator('[data-filter]').filter({hasText:type}).first().click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>l.archetype.includes(type)).length);
  await page.getByRole('button',{name:'全部体系',exact:true}).click();
  await page.selectOption('#sort','recent');
  const dates=await page.locator('[data-card]').evaluateAll(els=>els.map(e=>(e as HTMLElement).dataset.date!));
  expect(dates).toEqual([...dates].sort((a,b)=>b.localeCompare(a)));
  await page.selectOption('#sort','recommended');
  await page.getByRole('checkbox',{name:'有教学视频'}).check();
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.filter(l=>l.tutorials.length>0).length);
  for(const l of activeLineups.filter(l=>l.tutorials.length>0)){
    const card=page.locator('[data-card]').filter({has:page.getByRole('heading',{name:l.name,exact:true})});
    for(const t of l.tutorials)await expect(card.locator('.video-link')).toHaveAttribute('href',t.url);
  }
  expect(await page.locator('a a').count()).toBe(0);
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
    await expect(page.locator('#analysis,.lead-block,.plan-list,.rating-note,.tier')).toHaveCount(0);
    await expect(page.locator('#guides')).toHaveCount(lineup.guides.length?1:0);
    await expect(page.locator('#tutorials .video-row')).toHaveCount(lineup.tutorials.length);
    await expect(page.locator('#tutorials .info-gap')).toHaveCount(lineup.tutorials.length?0:1);
    await expect(page.locator('#signals .source-row')).toHaveCount(lineup.signals.length);
    await expect(page.locator('.detail-provenance')).toContainText(lineup.lineup_images[0].evidence_grade==='A'?'作者或一手来源':lineup.lineup_images[0].evidence_grade==='B'?'可信图文来源':'转载图源·已交叉核对');
    await expect(page.locator('#roster .info-gap')).toContainText(`${lineup.roster.filter(p=>p.skills.length>0).length} / 6`);
    await expect(page.locator('.detail-nav-inner>a')).toHaveText(/返回阵容总览|返回往期阵容/);
    const images=await page.locator('img').evaluateAll(els=>els.map(el=>{const e=el as HTMLImageElement;return {loaded:e.complete&&e.naturalWidth>0,fit:getComputedStyle(e).objectFit,ratio:e.getBoundingClientRect().width/e.getBoundingClientRect().height,natural:e.naturalWidth/e.naturalHeight};}));
    for(const img of images){expect(img.loaded).toBe(true);expect(img.fit).toBe('contain');expect(Math.abs(img.ratio-img.natural)).toBeLessThan(.01);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:`artifacts/detail-${info.project.name}.png`,fullPage:true});
  await page.locator('.bottom-return').click();await expect(page).toHaveTitle(/往期阵容/);
  expect(errors).toEqual([]);
});

test('往期赛季和搜索组合，旧链接跳转正确',async({page})=>{
  await page.goto('./');await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'往期阵容'}).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  const season=historyLineups[0].season;await page.locator(`[data-season-filter="${season}"]`).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.filter(l=>l.season===season).length);
  await page.getByRole('searchbox').fill('no-such-lineup');await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await page.getByRole('button',{name:'重置筛选'}).click();await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  await page.goto('updates/');await expect(page).toHaveURL(/history/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('逐卡视觉检查：统一预览框、同排边界和标题对齐，保留全部原图',async({page},info)=>{
  const folder=`artifacts/cards-${info.project.name}`;await mkdir(folder,{recursive:true});
  for(const [route,lineups] of [['./',activeLineups],['history/',historyLineups]] as const){
    await page.goto(route);
    const cards=page.locator('[data-card]');
    for(let i=0;i<await cards.count();i++){
      const card=cards.nth(i),img=card.locator('img');
      await card.scrollIntoViewIfNeeded();await img.evaluate((e:HTMLImageElement)=>e.decode());
      const layout=await card.evaluate(e=>{
        const frame=e.querySelector('.card-image')!,image=e.querySelector('img')!,title=e.querySelector('h3')!;
        const f=frame.getBoundingClientRect(),r=e.getBoundingClientRect(),t=title.getBoundingClientRect();
        return {ratio:f.width/f.height,fit:getComputedStyle(image).objectFit,frameInside:f.left>=r.left&&f.right<=r.right&&f.top>=r.top&&f.bottom<=r.bottom,titleInside:t.left>=r.left&&t.right<=r.right,loaded:image.complete&&image.naturalWidth>0};
      });
      expect(layout.loaded).toBe(true);expect(layout.fit).toBe('contain');
      expect(Math.abs(layout.ratio-4/3)).toBeLessThan(.01);expect(layout.frameInside).toBe(true);expect(layout.titleInside).toBe(true);
      const href=await card.locator('.card-link').getAttribute('href'),lineup=lineups.find(l=>href?.includes(`/lineups/${l.slug}/`))!;
      await card.screenshot({path:`${folder}/${lineup.slug}.png`});
    }
    const rows=await cards.evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,title:e.querySelector('h3')!.getBoundingClientRect().top})));
    for(const a of rows)for(const b of rows)if(Math.abs(a.top-b.top)<1){expect(Math.abs(a.bottom-b.bottom)).toBeLessThan(1);expect(Math.abs(a.title-b.title)).toBeLessThan(1);}
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`artifacts/${route==='./'?'overview':'history'}-cards-${info.project.name}.png`,fullPage:true});
  }
});
