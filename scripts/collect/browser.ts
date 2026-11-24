import { chromium, type Browser } from '@playwright/test';
import { assertPublicUrl } from './network';

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser;
  if (launching) return launching;
  launching = chromium
    .launch({
      headless: true,
      ...(process.env.RESEARCH_CHROMIUM_PATH
        ? { executablePath: process.env.RESEARCH_CHROMIUM_PATH }
        : {}),
    })
    .then((browser) => {
      sharedBrowser = browser;
      browser.on('disconnected', () => {
        if (sharedBrowser === browser) sharedBrowser = null;
      });
      return browser;
    })
    .finally(() => {
      launching = null;
    });
  return launching;
}

export async function closeBrowserPool(): Promise<void> {
  const browser = sharedBrowser;
  sharedBrowser = null;
  if (browser?.isConnected()) {
    await browser.close().catch(() => {});
  }
}

// Fresh incognito context per URL: no persistent profile, private cookies, or login,
// while reusing a single Chromium process across the run.
export async function publicBrowserSnapshot(url: string) {
  await assertPublicUrl(url);
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
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
    await context.close().catch(() => {});
  }
}
