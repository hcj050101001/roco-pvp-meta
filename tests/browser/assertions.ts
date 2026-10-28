import { expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lineup } from '../../src/lib/schema';

export async function expectVideoLinks(card: Locator, urls: string[]) {
  const links = card.locator('.video-link');
  await expect(links).toHaveCount(urls.length);
  for (const [index, url] of urls.entries())
    await expect(links.nth(index)).toHaveAttribute('href', url);
}

export async function expectConfigurationImages(page: Page, count: number) {
  const images = page.locator('.full-image img');
  await expect(images).toHaveCount(count);
  for (let index = 0; index < count; index++) {
    if (count > 1) await page.locator('[data-image-tab]').nth(index).click();
    const image = images.nth(index);
    await expect(image).toBeVisible();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    const geometry = await image.evaluate((element: HTMLImageElement) => {
      const bounds = element.getBoundingClientRect();
      return {
        loaded: element.complete && element.naturalWidth > 0,
        fit: getComputedStyle(element).objectFit,
        ratio: bounds.width / bounds.height,
        natural: element.naturalWidth / element.naturalHeight,
      };
    });
    expect(geometry.loaded).toBe(true);
    expect(geometry.fit).toBe('contain');
    expect(Math.abs(geometry.ratio - geometry.natural)).toBeLessThan(0.01);
  }
}

export async function expectCardImage(image: Locator, original: Lineup['lineup_images'][number]) {
  await image.scrollIntoViewIfNeeded();
  await image.evaluate((element: HTMLImageElement) => element.decode());
  const widths = [480, 800].filter(
    (width) =>
      original.width > width &&
      existsSync(resolve('public/assets/lineups/derived', `${original.sha256}-${width}.webp`)),
  );
  if (widths.length) {
    const prefix = `${process.env.TEST_BASE || ''}/assets/lineups/derived/${original.sha256}`;
    await expect(image).toHaveAttribute(
      'srcset',
      widths.map((width) => `${prefix}-${width}.webp ${width}w`).join(', '),
    );
    const loaded = await image.evaluate((element: HTMLImageElement) => ({
      src: element.currentSrc,
      width: element.naturalWidth,
    }));
    const selectedWidth = widths.find((width) => loaded.src.endsWith(`${prefix}-${width}.webp`));
    expect(selectedWidth).toBeDefined();
    // naturalWidth is density-corrected for width-descriptor srcsets, not the file's pixel width.
    expect(loaded.width).toBeGreaterThan(0);
    expect(loaded.width).toBeLessThanOrEqual(selectedWidth!);
  } else {
    await expect(image).not.toHaveAttribute('srcset');
    await expect(image).toHaveAttribute('src', `${process.env.TEST_BASE || ''}${original.path}`);
    await expect(image).toHaveJSProperty('naturalWidth', original.width);
  }
}
