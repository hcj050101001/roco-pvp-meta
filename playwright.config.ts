import { defineConfig } from '@playwright/test';
const base = process.env.TEST_BASE || '';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:4321${base}/`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // 沙箱环境下 Chromium 的 zygote 进程曾因 IPC 写操作 EPERM 而整体退出，
    // 导致全部浏览器测试在数毫秒内失败（与代码无关）。禁用 zygote 后渲染进程
    // 由浏览器进程直接派生，彻底去掉这条故障链路。
    launchOptions: { args: ['--no-zygote'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: `http://127.0.0.1:4321${base}/`,
    reuseExistingServer: !process.env.CI,
    env: { SITE_BASE: base || '/' },
  },
});
