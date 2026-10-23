import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { activeLineups } from '../../src/lib/data';

const routes=['./','history/',`lineups/${activeLineups[0].slug}/`];

for(const route of routes){
  test(`可访问性：${route}`,async({page})=>{
    await page.goto(route);
    await page.evaluate(()=>document.fonts.ready);
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    const severe=results.violations.filter(v=>v.impact==='critical'||v.impact==='serious');
    expect(severe.map(v=>`${v.id}: ${v.help}\n${v.nodes.map(n=>`  ${n.target.join(' ')}`).join('\n')}`)).toEqual([]);
  });
}
