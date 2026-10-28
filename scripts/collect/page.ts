import { publicFetch } from './network';
import { publicBrowserSnapshot } from './browser';

function assertPage(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  if (
    /访问验证|安全验证|请完成验证|Access Denied|验证码|验证中心/i.test(title) ||
    /bili-risk-control|captcha-container/i.test(html) ||
    html.length < 300
  )
    throw Error('访问受限或响应不完整');
}

// Keep each HTML document paired with the URL that actually produced it.
export async function sourceDocument(
  url: string,
  options: {
    browser?: boolean;
    fetcher?: typeof publicFetch;
    snapshotter?: typeof publicBrowserSnapshot;
  } = {},
) {
  const response = await (options.fetcher ?? publicFetch)(url, 8_000_000);
  const html = response.body.toString('utf8');
  assertPage(html);
  if (options.browser) {
    try {
      const snapshot = await (options.snapshotter ?? publicBrowserSnapshot)(url);
      assertPage(snapshot.html);
      return {
        html: snapshot.html,
        url: snapshot.url,
        screenshot: snapshot.screenshot,
        browser_error: null,
      };
    } catch (error) {
      // Browser failure retains both the public fetch document and its own URL.
      return { html, url: response.url, screenshot: undefined, browser_error: String(error) };
    }
  }
  return { html, url: response.url, screenshot: undefined, browser_error: null };
}
