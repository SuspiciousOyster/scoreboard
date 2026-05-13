const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 3600 } });

  // Navigate and wait for the JS to render
  await page.goto('http://localhost:8899/demo-preview.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Take full-page screenshot
  await page.screenshot({ path: '/home/hermes/workspace/scoreboard/demo-screenshot.png', fullPage: true });

  await browser.close();
  console.log('Screenshot saved');
})();
