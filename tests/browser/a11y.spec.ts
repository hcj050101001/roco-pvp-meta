import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { activeLineups, historyLineups } from '../../src/lib/data';
import { additionalStaticPages } from '../../src/lib/static-pages';

const routes = [
  './',
  'history/',
  `lineups/${activeLineups[0].slug}/`,
  'timeline/',
  'compare/',
  'systems/',
  ...additionalStaticPages(activeLineups.length).map((page) => `page/${page}/`),
  ...additionalStaticPages(historyLineups.length).map((page) => `history/page/${page}/`),
];

for (const route of routes) {
  test(`可访问性：${route}`, async ({ page }) => {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const severe = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      severe.map(
        (v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.target.join(' ')}`).join('\n')}`,
      ),
    ).toEqual([]);
  });
}

test('阵容对比可用键盘选择、处理相同选择并恢复', async ({ page }) => {
  await page.goto('compare/');
  const first = page.getByRole('combobox', { name: '第一套阵容' });
  const second = page.getByRole('combobox', { name: '第二套阵容' });
  await first.focus();
  await first.press('End');
  const last = await first.inputValue();
  await expect(page.locator('#compare-left h2 a')).toHaveAttribute(
    'href',
    new RegExp(`/lineups/${last}/$`),
  );
  await second.focus();
  await second.press('End');
  await expect(page.getByRole('status')).toHaveText('请选择两套不同的阵容。');
  await expect(page.locator('#compare-left h2')).toHaveCount(0);
  await second.press('Home');
  await expect(page.locator('#compare-right h2 a')).toHaveAttribute(
    'href',
    new RegExp(`/lineups/${await second.inputValue()}/$`),
  );
  await expect(page.getByRole('status')).toContainText('正在对比');
});

test('共现图的标签可用 Tab 聚焦并以 Enter 跳到关联阵容', async ({ page }) => {
  await page.goto('systems/');
  const nodes = page.locator('.system-graph a');
  expect(await nodes.count()).toBeGreaterThan(1);
  await nodes.first().focus();
  await page.keyboard.press('Tab');
  await expect(nodes.nth(1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  const target = await nodes.first().getAttribute('href');
  expect(target).toMatch(/^#system-\d+$/);
  await expect(page.locator(target!)).toBeInViewport();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(`${target} a`).first()).toBeVisible();
});

for (const [root, lineups] of [
  ['', activeLineups],
  ['history/', historyLineups],
] as const) {
  if (!additionalStaticPages(lineups.length).length) continue;
  test(`静态分页可用键盘翻页、进入详情并返回：${root || '当季'}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const base = `http://127.0.0.1:4321${process.env.TEST_BASE || ''}/`;
    try {
      await page.goto(new URL(`${root}page/2/`, base).href);
      const previous = page.getByRole('navigation', { name: '静态阵容分页' }).getByRole('link', {
        name: '上一页',
      });
      await previous.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new URL(root, base).href);
      const next = page.getByRole('navigation', { name: '静态阵容分页' }).getByRole('link', {
        name: '下一页',
      });
      await next.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new URL(`${root}page/2/`, base).href);
    } finally {
      await context.close();
    }
    const interactive = await browser.newContext();
    const detailPage = await interactive.newPage();
    try {
      await detailPage.goto(new URL(`${root}page/2/`, base).href);
      await expect(detailPage.locator('.static-pagination')).toBeHidden();
      const card = detailPage.locator('[data-card] .card-link').first();
      await card.focus();
      await detailPage.keyboard.press('Enter');
      await expect(detailPage).toHaveURL(/\/lineups\/[^/]+\//);
      const back = detailPage.locator('.detail-nav-inner > a');
      await back.focus();
      await detailPage.keyboard.press('Enter');
      await expect(detailPage).toHaveURL(new RegExp(`/${root}page/2/#lineup-`));
      await expect(detailPage.locator('[data-card]').first()).toBeInViewport();
    } finally {
      await interactive.close();
    }
  });
}
