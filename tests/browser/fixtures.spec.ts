import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { activeLineups } from '../../src/lib/data';
import { expectCardImage, expectConfigurationImages, expectVideoLinks } from './assertions';

// Exercise supported combinations against built pages and their real client scripts.
// Response fixtures stay in the test browser; production lineup files are untouched.
test('合法双视频与小图回退可以通过卡片验收', async ({ page }) => {
  const lineup = activeLineups[0],
    base = process.env.TEST_BASE || '';
  const urls = ['https://example.com/tutorial-one', 'https://example.com/tutorial-two'];
  const path = '/assets/lineups/test-fixture/small.png';
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#abcdef';
    context.fillRect(0, 0, 400, 300);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const bytes = Buffer.from(png, 'base64');
  await page.route(`**${path}`, (route) =>
    route.fulfill({ contentType: 'image/png', body: bytes }),
  );
  await page.route(`**${base}/`, async (route) => {
    const response = await route.fetch(),
      $ = cheerio.load(await response.text());
    const card = $(`#lineup-${lineup.slug}`);
    card.find('.video-link').remove();
    for (const [index, url] of urls.entries())
      card
        .find('.card-actions')
        .append(`<a class="video-link" href="${url}">教学 ${index + 1}</a>`);
    card
      .find('img')
      .attr({ src: `${base}${path}`, width: '400', height: '300' })
      .removeAttr('srcset')
      .removeAttr('sizes');
    await route.fulfill({ response, body: $.html() });
  });
  await page.goto('./');
  const card = page.locator(`#lineup-${lineup.slug}`);
  await expectVideoLinks(card, urls);
  await expectCardImage(card.locator('img'), {
    ...lineup.lineup_images[0],
    path,
    width: 400,
    height: 300,
  });
});

test('多配置图逐个切换验收，隐藏图片不参与几何检查', async ({ page }) => {
  const lineup = activeLineups[0],
    base = process.env.TEST_BASE || '';
  await page.route(`**${base}/lineups/${lineup.slug}/`, async (route) => {
    const response = await route.fetch(),
      $ = cheerio.load(await response.text());
    const tabs = $('.image-tabs').removeAttr('hidden');
    tabs.find('button').remove();
    for (let index = 0; index < 2; index++)
      tabs.append(
        `<button role="tab" id="tab-${index}" aria-controls="image-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-image-tab="${index}">配置 ${index + 1}</button>`,
      );
    const first = $('.full-image').first().attr({ role: 'tabpanel', 'aria-labelledby': 'tab-0' });
    first.after(first.clone().attr({ id: 'image-1', 'aria-labelledby': 'tab-1', hidden: '' }));
    await route.fulfill({ response, body: $.html() });
  });
  await page.goto(`lineups/${lineup.slug}/`);
  await expect(page.locator('#image-1')).toBeHidden();
  await expectConfigurationImages(page, 2);
  await expect(page.locator('#tab-1')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#tab-1').press('ArrowLeft');
  await expect(page.locator('#image-0')).toBeVisible();
  await expect(page.locator('#image-1')).toBeHidden();
});
