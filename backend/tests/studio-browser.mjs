// Run with the demo server running and the frontend's Playwright installed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const requireFrontend = createRequire(new URL('../../前端文件/package.json', import.meta.url));
const {chromium} = requireFrontend('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 960}, reducedMotion: 'reduce'});
  await page.goto('http://127.0.0.1:8000/');
  await page.getByRole('button', {name: '连接设置'}).click();
  await page.locator('#data-mode').selectOption('api');
  const simulation = page.waitForResponse(r => r.url().endsWith('/api/simulate') && r.ok());
  await page.getByRole('button', {name: '应用连接设置'}).click();
  const result = await (await simulation).json();
  assert.equal(result.heatmap_grid.length, 24);
  assert.ok(result.heatmap_grid.every(row => row.length === 24));
  await page.getByRole('button', {name: '采光热力'}).click();
  await page.getByRole('button', {name: '冬至正午'}).click();
  const score = page.locator('.score-capsule');
  await page.waitForFunction(points => document.querySelector('.score-capsule')
    ?.getAttribute('aria-label')?.includes('方案评分 ' + points), result.score_report.total_score.toFixed(1));
  await score.click();
  await page.locator('.simulation-disclosure summary').click();
  await page.getByText('24 × 24 采光矩阵', {exact: false}).waitFor();
  assert.equal(await page.locator('.dimension-overview button').count(), 4);
  await score.click();
  const update = page.waitForResponse(r => r.url().endsWith('/api/simulate') &&
    r.request().postDataJSON().city_id === 'harbin' && r.ok());
  await page.locator('#city').selectOption('harbin');
  await update;
  const optimization = page.waitForResponse(r => r.url().endsWith('/api/optimize') && r.ok());
  await page.getByRole('button', {name: /一键寻优/}).click();
  const optimized = await (await optimization).json();
  assert.equal(optimized.parameters.city_id, 'harbin');
  await score.click();
  await page.locator('.comparison').filter({hasText: '寻优参数已应用'}).waitFor({state: 'attached'});
  assert.equal(optimized.after.heatmap_grid.length, 24);
  console.log('Browser passed: API mode, heatmap, winter, score, city change and optimization.');
} finally {
  await browser.close();
}
