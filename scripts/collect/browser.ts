import { chromium } from '@playwright/test';
import { assertPublicUrl } from './network';
// A fresh browser context: no persistent profile, private cookies or login.
export async function publicBrowserSnapshot(url: string) {
  await assertPublicUrl(url);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.RESEARCH_CHROMIUM_PATH
      ? { executablePath: process.env.RESEARCH_CHROMIUM_PATH }
      : {}),
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', async (route) => {
      try {
        const u = new URL(route.request().url());
        if (u.protocol !== 'https:') return route.abort();
        await assertPublicUrl(u.href);
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    if (!response?.ok()) throw Error(`HTTP ${response?.status()}`);
    if (/验证码|安全验证|访问验证|登录|captcha|access denied/i.test(await page.title()))
      throw Error('访问控制阻止浏览');
    // Trigger deferred image nodes without interacting with login or CAPTCHA controls.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, innerHeight));
      await page.waitForTimeout(250);
    }
    return {
      html: await page.content(),
      screenshot: await page.screenshot({ fullPage: true }),
      url: page.url(),
    };
  } finally {
    await browser.close();
  }
}
