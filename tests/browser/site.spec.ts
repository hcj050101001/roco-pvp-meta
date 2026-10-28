import { test, expect } from '@playwright/test';
import { activeLineups, allLineups, historyLineups, overview } from '../../src/lib/data';
import { mkdir } from 'node:fs/promises';
import { expectCardImage, expectConfigurationImages, expectVideoLinks } from './assertions';
import { cardImageSources } from '../../src/lib/card-image';
import { configurationDate } from '../../src/lib/rank';
import { displayDate, withBase } from '../../src/lib/urls';

test('完整筛选链接可刷新分享，详情返回恢复筛选与卡片位置', async ({ page }) => {
  const lineup = historyLineups[0];
  const params = new URLSearchParams({
    season: lineup.season,
    q: lineup.roster[0].name,
    type: lineup.archetype[0],
    sort: 'name',
    ref: 'guide',
  });
  await page.goto(`history/?${params}`);
  await expect(page.getByRole('searchbox')).toHaveValue(lineup.roster[0].name);
  await expect(page.locator('#sort')).toHaveValue('recommended');
  await expect(page.locator(`[data-season-filter="${lineup.season}"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const card = page.locator(`#lineup-${lineup.slug}`);
  await expect(card).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue(lineup.roster[0].name);
  await card.locator('.card-cta').click();
  await expect(page.locator('.bottom-return')).toHaveAttribute(
    'href',
    `/roco-pvp-meta/history/?${params}#lineup-${lineup.slug}`.replace(
      '/roco-pvp-meta',
      process.env.TEST_BASE || '',
    ),
  );
  await page.locator('.bottom-return').click();
  await expect(page.getByRole('searchbox')).toHaveValue(lineup.roster[0].name);
  await expect(page.locator('#sort')).toHaveValue('recommended');
  await expect(card).toBeInViewport();
  await card.locator('.card-link').click();
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue(lineup.roster[0].name);
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return ['q', 'type', 'season', 'sort', 'video'].some((key) => url.searchParams.has(key));
    })
    .toBe(false);
  expect(new URL(page.url()).searchParams.get('ref')).toBe('guide');
  await page.goto(`./?video=1&sort=recent`);
  await expect(page.getByRole('checkbox', { name: '有教学视频' })).toBeChecked();
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    activeLineups.filter((l) => l.tutorials.length).length,
  );
  await page.goto(`lineups/${lineup.slug}/?returnTo=${encodeURIComponent('https://example.com/')}`);
  await expect(page.locator('.bottom-return')).toHaveAttribute(
    'href',
    `${process.env.TEST_BASE || ''}/history/`,
  );
});

test('玩家首页：固定明亮风格、体系筛选与全局排序', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/阵容图鉴/);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('link', { name: '收录准则', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '更新记录', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-card]:visible')).toHaveCount(activeLineups.length);
  await expect(page.locator('[data-current-count]')).toHaveText(
    `${String(overview.current.length).padStart(2, '0')}套`,
  );
  const query = activeLineups[0].roster[0].name;
  await page.getByRole('searchbox').fill(query);
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    activeLineups.filter((l) =>
      [l.name, ...l.aliases, ...l.archetype, ...l.roster.map((p) => p.name)]
        .join(' ')
        .includes(query),
    ).length,
  );
  await page.getByRole('searchbox').fill('no-such-lineup-xxxx');
  await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await expect(page.getByText('没有找到符合条件的阵容')).toBeVisible();
  await expect(page.getByRole('link', { name: '浏览往期阵容' })).toBeVisible();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('[data-tier-filter],.tier')).toHaveCount(0);
  const type = activeLineups[0].archetype[0];
  await page.locator('[data-filter]').filter({ hasText: type }).first().click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    activeLineups.filter((l) => l.archetype.includes(type)).length,
  );
  await page.getByRole('button', { name: '全部体系', exact: true }).click();
  await page.selectOption('#sort', 'recent');
  await expect
    .poll(() =>
      page
        .locator('[data-card]')
        .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.date!)),
    )
    .toEqual(
      [
        ...(await page
          .locator('[data-card]')
          .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.date!))),
      ].sort((a, b) => b.localeCompare(a)),
    );
  await page.selectOption('#sort', 'recommended');
  await page.getByRole('checkbox', { name: '有教学视频' }).check();
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    activeLineups.filter((l) => l.tutorials.length > 0).length,
  );
  for (const l of activeLineups.filter((l) => l.tutorials.length > 0)) {
    const card = page
      .locator('[data-card]')
      .filter({ has: page.getByRole('heading', { name: l.name, exact: true }) });
    await expectVideoLinks(
      card,
      l.tutorials.map((t) => t.url),
    );
  }
  expect(await page.locator('a a').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('当季和往期详情均可返回，完整原图无裁切', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  for (const img of await page.locator('img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveJSProperty('complete', true);
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `artifacts/home-${info.project.name}.png`, fullPage: true });
  await page.screenshot({ path: `artifacts/home-viewport-${info.project.name}.png` });
  for (const lineup of allLineups) {
    const response = await page.goto(`lineups/${lineup.slug}/`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('#analysis,.lead-block,.plan-list,.rating-note,.tier')).toHaveCount(
      0,
    );
    await expect(page.locator('#guides')).toHaveCount(lineup.guides.length ? 1 : 0);
    await expect(page.locator('#tutorials .video-row')).toHaveCount(lineup.tutorials.length);
    await expect(page.locator('#tutorials .info-gap')).toHaveCount(lineup.tutorials.length ? 0 : 1);
    await expect(page.locator('#signals .source-row')).toHaveCount(lineup.signals.length);
    await expect(page.locator('.detail-provenance')).toContainText(
      lineup.lineup_images[0].evidence_grade === 'A'
        ? '作者或一手来源'
        : lineup.lineup_images[0].evidence_grade === 'B'
          ? '可信图文来源'
          : '转载图源·已交叉核对',
    );
    await expect(page.locator('#roster .info-gap')).toContainText(
      `${lineup.roster.filter((p) => p.skills.length > 0).length} / 6`,
    );
    await expect(page.locator('.detail-nav-inner>a')).toHaveText(/返回阵容总览|返回往期阵容/);
    await expectConfigurationImages(page, lineup.lineup_images.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.screenshot({ path: `artifacts/detail-${info.project.name}.png`, fullPage: true });
  await page.locator('.bottom-return').click();
  await expect(page).toHaveTitle(/往期阵容/);
  expect(errors).toEqual([]);
});

test('卡片按可用派生图加载或回退原图，详情页保留原始尺寸', async ({ page }) => {
  await page.goto('./');
  const cards = page.locator('[data-card]');
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await expectCardImage(cards.nth(i).locator('img'), activeLineups[i].lineup_images[0]);
  }
  const lineup = activeLineups[0];
  await page.goto(`lineups/${lineup.slug}/`);
  const detail = page.locator('.full-image img').first();
  await detail.scrollIntoViewIfNeeded();
  await expect
    .poll(() => detail.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBe(lineup.lineup_images[0].width);
  expect(await detail.evaluate((e: HTMLImageElement) => e.currentSrc)).not.toContain('/derived/');
});

test('往期赛季和搜索组合，旧链接跳转正确', async ({ page }) => {
  await page.goto('./');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '往期阵容' })
    .click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  const season = historyLineups[0].season;
  await page.locator(`[data-season-filter="${season}"]`).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    historyLineups.filter((l) => l.season === season).length,
  );
  await page.getByRole('searchbox').fill('no-such-lineup');
  await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  await page.goto('updates/');
  await expect(page).toHaveURL(/history/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('筛选状态可清除，排序说明和视频开关支持键盘', async ({ page }) => {
  await page.goto('history/?season=S3&ref=guide#main');
  await expect(page.getByRole('button', { name: '清除筛选' })).toBeVisible();
  await page.getByRole('searchbox').fill(historyLineups[0].roster[0].name);
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.getByRole('button', { name: '清除筛选' })).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('season')).toBe(false);
  expect(new URL(page.url()).searchParams.get('ref')).toBe('guide');
  expect(new URL(page.url()).hash).toBe('#main');
  const explanation = page.locator('.sort-note summary');
  await explanation.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sort-explanation')).toBeVisible();
  const video = page.getByRole('checkbox', { name: '有教学视频' });
  await video.focus();
  await page.keyboard.press('Space');
  await expect(video).toBeChecked();
  await expect(page.locator('[data-card]:visible')).toHaveCount(
    historyLineups.filter((l) => l.tutorials.length > 0).length,
  );
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(video).not.toBeChecked();
  await expect(page.locator('[data-card]:visible')).toHaveCount(historyLineups.length);
});

test('窄屏和平板保持完整布局与可点击导航', async ({ page }) => {
  for (const width of [320, 580, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['./', 'history/', `lineups/${activeLineups[0].slug}/`, '404.html']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const navigation = page.getByRole('navigation', { name: '主导航' });
      for (const link of await navigation.getByRole('link').all()) {
        const bounds = await link.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        expect(bounds!.height).toBeGreaterThanOrEqual(40);
      }
    }
  }
});

test('默认首访不取完整索引；500 条测试样例仍只绘制 24 张卡片', async ({ page }) => {
  let indexRequests = 0;
  await page.route('**/collection-index.json', async (route) => {
    indexRequests++;
    const lineup = activeLineups[0];
    const image = cardImageSources(lineup.lineup_images[0]);
    const date = configurationDate(lineup);
    const item = (index: number) => ({
      slug: `sample-${index}`,
      name: `Test Hero ${index}`,
      season: lineup.season,
      archetype: lineup.archetype,
      label: 'current',
      search: `test hero ${index} ${lineup.roster.map((p) => p.name).join(' ')}`.toLowerCase(),
      date: date ?? '',
      dateKind: date ? 'published' : 'season',
      dateText: date ? displayDate(date) : lineup.season,
      video: false,
      index,
      roster: lineup.roster.map((p) => p.name).join(' · '),
      image,
      videos: [],
      href: withBase(`/lineups/${lineup.slug}/`),
    });
    await route.fulfill({
      json: { active: Array.from({ length: 500 }, (_, i) => item(i)), history: [] },
    });
  });
  await page.goto('./');
  expect(indexRequests).toBe(0);
  await expect(page.locator('#result-count')).toHaveText(`共 ${activeLineups.length} 套阵容`);
  const started = await page.evaluate(() => performance.now());
  await page.getByRole('searchbox').fill('ＴＥＳＴ');
  await expect(page.locator('#result-count')).toContainText('共 500 套阵容');
  const elapsedMs = await page.evaluate((start) => performance.now() - start, started);
  test.info().annotations.push({ type: '500-sample-search-ms', description: elapsedMs.toFixed(1) });
  expect(elapsedMs).toBeLessThan(500);
  await expect(page.locator('[data-card]')).toHaveCount(24);
  expect(indexRequests).toBe(1);
});

test('索引失败可读且能重试；翻页后焦点落在结果列表', async ({ page }) => {
  let attempts = 0;
  await page.route('**/collection-index.json', async (route) => {
    attempts++;
    if (attempts === 1) await route.abort();
    else await route.continue();
  });
  await page.goto('./?q=not-a-match');
  await expect(page.locator('#index-status')).toContainText('加载失败');
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.locator('#index-status')).toBeHidden();
  expect(attempts).toBe(2);
  await page.goto('./');
  if (activeLineups.length > 24) {
    await page.getByRole('button', { name: '下一页' }).click();
    await expect(page.locator('#lineup-grid')).toBeFocused();
  }
});

test('配置图片加载失败时展示可读状态', async ({ page }) => {
  await page.route('**/assets/lineups/**', (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('[data-card] .image-load-fallback').first()).toBeVisible();
});

test('320px 与 200% 字体放大无横向溢出且搜索焦点保留', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const search = page.getByRole('searchbox');
  await search.fill(activeLineups[0].roster[0].name);
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('逐卡视觉检查：统一预览框、同排边界和标题对齐，保留全部原图', async ({ page }, info) => {
  const folder = `artifacts/cards-${info.project.name}`;
  await mkdir(folder, { recursive: true });
  for (const [route, lineups] of [
    ['./', activeLineups],
    ['history/', historyLineups],
  ] as const) {
    await page.goto(route);
    const cards = page.locator('[data-card]');
    for (let i = 0; i < (await cards.count()); i++) {
      const card = cards.nth(i),
        img = card.locator('img');
      await card.scrollIntoViewIfNeeded();
      await img.evaluate((e: HTMLImageElement) => e.decode());
      const layout = await card.evaluate((e) => {
        const frame = e.querySelector('.card-image')!,
          image = e.querySelector('img')!,
          title = e.querySelector('h3')!;
        const f = frame.getBoundingClientRect(),
          r = e.getBoundingClientRect(),
          t = title.getBoundingClientRect();
        return {
          ratio: f.width / f.height,
          fit: getComputedStyle(image).objectFit,
          frameInside:
            f.left >= r.left && f.right <= r.right && f.top >= r.top && f.bottom <= r.bottom,
          titleInside: t.left >= r.left && t.right <= r.right,
          loaded: image.complete && image.naturalWidth > 0,
        };
      });
      expect(layout.loaded).toBe(true);
      expect(layout.fit).toBe('contain');
      expect(Math.abs(layout.ratio - 4 / 3)).toBeLessThan(0.01);
      expect(layout.frameInside).toBe(true);
      expect(layout.titleInside).toBe(true);
      const href = await card.locator('.card-link').getAttribute('href'),
        lineup = lineups.find((l) => href?.includes(`/lineups/${l.slug}/`))!;
      await card.screenshot({ path: `${folder}/${lineup.slug}.png` });
    }
    const rows = await cards.evaluateAll((es) =>
      es.map((e) => ({
        top: e.getBoundingClientRect().top,
        bottom: e.getBoundingClientRect().bottom,
        title: e.querySelector('h3')!.getBoundingClientRect().top,
      })),
    );
    for (const a of rows)
      for (const b of rows)
        if (Math.abs(a.top - b.top) < 1) {
          expect(Math.abs(a.bottom - b.bottom)).toBeLessThan(1);
          expect(Math.abs(a.title - b.title)).toBeLessThan(1);
        }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/${route === './' ? 'overview' : 'history'}-cards-${info.project.name}.png`,
      fullPage: true,
    });
  }
});
