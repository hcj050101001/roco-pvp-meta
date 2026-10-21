import { defineConfig } from '@playwright/test';
const base=process.env.TEST_BASE || '';
export default defineConfig({
  testDir:'tests/browser',
  fullyParallel:true,
  use:{baseURL:`http://127.0.0.1:4321${base}/`,screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'npm run preview -- --port 4321',url:`http://127.0.0.1:4321${base}/`,reuseExistingServer:!process.env.CI,env:{SITE_BASE:base||'/'}},
});
