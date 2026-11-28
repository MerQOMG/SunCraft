import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DEFAULTS, PRESETS } from '../../src/model';
import { mockSimulate, mockOptimize } from '../fixtures/mockSimulation';
import { localSimulate } from '../../src/localEngine';

const evidence = 'test-results/evidence';
mkdirSync(evidence, { recursive: true });
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

async function settings(page: Page, mode: 'mock' | 'api') {
  await page.getByRole('button', { name: '连接设置', exact: true }).click();
  await page.locator('#data-mode').selectOption(mode);
  await page.getByRole('button', { name: '应用连接设置' }).click();
}
async function ready(page: Page) {
  await page.goto('/');
  // Test the server-free local model; the development default remains API.
  await settings(page, 'mock');
  await expect(page.getByRole('button', { name: '导出设计单' })).toBeEnabled();
  await expect(page.locator('.statusbar')).toContainText('3D 场景就绪');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('91.1');
}
async function cases(page: Page) {
  if ((await page.locator('#score-drawer').getAttribute('aria-hidden')) === 'true') {
    await page.locator('.score-capsule').click();
  }
  await page.getByRole('tab', { name: '两至工况' }).click();
}

test('renders 3D, current design score, winter date and heat overlay', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.scene canvas')).toBeVisible();
  await expect(page.locator('.score-capsule')).toContainText('方案实时分');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('91.1');
  await page.screenshot({ path: `${evidence}/desktop.png` });
  await page.getByRole('button', { name: '冬至正午', exact: true }).click();
  await expect(page.locator('input[type=date]')).toHaveValue('2026-12-22');
  await page.getByRole('button', { name: '采光热力', exact: true }).click();
  await expect(page.locator('.heat-legend')).toBeVisible();
  await cases(page);
  await expect(page.locator('.data-notice')).toContainText('本地实时计算');
  await expect(page.locator('.metric.terra .metric-top strong')).toHaveText('100%');
  await page.screenshot({ path: `${evidence}/winter-heat.png` });
});

test('Guangzhou keeps the real north-side summer sun and does not score it as failed shading', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#city').selectOption('guangzhou');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('79.4');
  await expect(page.locator('.solar-position-note')).toContainText('太阳在北侧');
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator('.scene').getAttribute('data-solar-frame'))!).latitude,
    )
    .toBe(23.1);
  const frame = JSON.parse((await page.locator('.scene').getAttribute('data-solar-frame'))!);
  expect(frame.direction.z).toBeGreaterThan(0);
  await cases(page);
  await expect(page.locator('.metric.terra .metric-top strong')).toHaveText('无直射');
  await page.getByRole('tab', { name: '评分细则' }).click();
  await expect(page.locator('.annual-applicability')).toContainText('按无直射风险计分');
  await page.getByRole('button', { name: '关闭光热分析' }).click();
  await page.getByRole('button', { name: '冬至正午', exact: true }).click();
  await expect(page.locator('.solar-position-note')).toHaveCount(0);
  await expect
    .poll(
      async () =>
        JSON.parse((await page.locator('.scene').getAttribute('data-solar-frame'))!).direction.z,
    )
    .toBeLessThan(0);
  await page.screenshot({ path: `${evidence}/guangzhou-winter.png` });
});

test('date light changes with the timeline while the separate DF layer stays constant', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: '采光热力', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', '2026-06-21');
  const summer = JSON.parse((await page.locator('.scene').getAttribute('data-heatmap-summary'))!);
  await page.getByRole('button', { name: '冬至正午', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', '2026-12-22');
  const winter = JSON.parse((await page.locator('.scene').getAttribute('data-heatmap-summary'))!);
  expect(winter.mean).toBeGreaterThan(summer.mean);
  expect(winter.directArea).toBeGreaterThan(summer.directArea);
  await expect(page.locator('.heat-date')).toContainText('2026-12-22');
  const bounds = await page.evaluate(() => ({
    legend: document.querySelector('.heat-legend')!.getBoundingClientRect().bottom,
    timeline: document.querySelector('.annual-timeline')!.getBoundingClientRect().top,
  }));
  expect(bounds.legend).toBeLessThan(bounds.timeline);
  await page.screenshot({ path: `${evidence}/date-light-winter.png` });
  await page.getByRole('button', { name: '全阴天DF', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-mode', 'df');
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', '');
  const df = await page.locator('.scene').getAttribute('data-heatmap-summary');
  await page.getByRole('button', { name: '夏至正午', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-summary', df!);
  await expect(page.locator('.heat-legend')).toContainText('与日期无关');
  await page.getByRole('button', { name: '日期光照', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', '2026-06-21');
  await page.setViewportSize({ width: 390, height: 534 });
  const mobileBounds = await page.evaluate(() => ({
    legend: document.querySelector('.heat-legend')!.getBoundingClientRect(),
    scene: document.querySelector('.scene')!.getBoundingClientRect(),
  }));
  expect(mobileBounds.legend.right).toBeLessThanOrEqual(390);
  expect(mobileBounds.legend.bottom).toBeLessThanOrEqual(mobileBounds.scene.bottom);
});

test('heatmap follows date playback and its paused date without stale cells', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '采光热力', exact: true }).click();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', '2026-06-21');
  await page.getByRole('button', { name: /^播放日期/ }).click();
  await expect(page.locator('input[type=date]')).not.toHaveValue('2026-06-21');
  await page.getByRole('button', { name: /^暂停日期/ }).click();
  const paused = await page.locator('input[type=date]').inputValue();
  await expect(page.locator('.scene')).toHaveAttribute('data-heatmap-date', paused);
  await expect(page.locator('.heat-date')).toContainText(paused);
});

test('sliders, city and reset update the design and pause playback', async ({ page }) => {
  await ready(page);
  await page.locator('#overhang_depth_m').fill('1.2');
  await expect(page.locator('output[for=overhang_depth_m]')).toHaveText('1.20m');
  await page.locator('#city').selectOption('beijing');
  await expect(page.locator('.location-meta')).toContainText('39.9');
  await page.locator('#window_wall_ratio').fill('0.65');
  await page.getByRole('button', { name: /^播放日期/ }).click();
  await expect(page.getByRole('button', { name: /^暂停日期/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /^重置参数与视角/ }).click();
  await expect(page.locator('output[for=overhang_depth_m]')).toHaveText('0.40m');
  await expect(page.locator('#window_wall_ratio')).toHaveValue('0.45');
  await expect(page.locator('#city')).toHaveValue('beijing');
  await expect(page.locator('input[type=date]')).toHaveValue('2026-06-21');
  await expect(page.getByRole('button', { name: /^播放日期/ })).toBeVisible();
});

test('different designs update the capsule and report, then reset restores the score', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#overhang_depth_m').fill('1.8');
  await page.locator('#louver_angle_deg').fill('80');
  await page.locator('#window_wall_ratio').fill('0.65');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('67.3');
  await page.locator('.score-capsule').click();
  await expect(page.getByRole('heading', { name: '当前方案评分 · 本地实时计算' })).toBeVisible();
  await expect(page.locator('.dimension-overview button')).toHaveCount(4);
  await expect(page.locator('.score-provenance')).toContainText('当前方案的本地模型计算');
  await page.screenshot({ path: `${evidence}/changed-design.png` });
  await page.getByRole('button', { name: '关闭光热分析' }).click();
  await page.getByRole('button', { name: /^重置参数与视角/ }).click();
  await expect(page.locator('.score-capsule .score-number')).toHaveText('91.1');
});

test('infeasible optimization keeps the current design score available', async ({ page }) => {
  await ready(page);
  await page.locator('#window_wall_ratio').fill('0.25');
  await expect(page.getByRole('button', { name: /一键寻优/ })).toBeEnabled();
  const before = localSimulate({
    ...DEFAULTS,
    window_wall_ratio: 0.25,
  }).score_report!.total_score!.toFixed(1);
  await expect(page.locator('.score-capsule .score-number')).toHaveText(before);
  await page.getByRole('button', { name: /一键寻优/ }).click();
  await expect(page.locator('.collapsed-error')).toContainText('寻优未完成');
  await expect(page.locator('.score-capsule .score-number')).toHaveText(before);
  await expect(page.getByRole('button', { name: '导出设计单' })).toBeEnabled();
});

test('optimization completes on a slow renderer and preserves the window ratio', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: /一键寻优/ }).click();
  await expect(page.locator('#window_wall_ratio')).toBeDisabled();
  await expect(page.locator('.comparison')).toHaveCount(1);
  await expect(page.locator('#window_wall_ratio')).toHaveValue('0.45');
  await expect(page.locator('#overhang_depth_m')).toBeEnabled();
  await expect(page.locator('.score-capsule .score-number')).toHaveText('94.4');
});

test('cancelled optimization cannot overwrite a later edit', async ({ page }) => {
  await ready(page);
  let started = false;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/presets', (route) => route.fulfill({ json: PRESETS }));
  await page.route('**/api/simulate', (route) =>
    route.fulfill({ json: mockSimulate(route.request().postDataJSON()) }),
  );
  await page.route('**/api/optimize', async (route) => {
    started = true;
    await blocked;
    await route.fulfill({ json: mockOptimize(DEFAULTS) }).catch(() => {});
  });
  await settings(page, 'api');
  await expect(page.getByRole('button', { name: /一键寻优/ })).toBeEnabled();
  await page.getByRole('button', { name: /一键寻优/ }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: '取消寻优', exact: true }).click();
  await page.locator('#overhang_depth_m').fill('1.2');
  release();
  await page.waitForTimeout(1600);
  await expect(page.locator('#overhang_depth_m')).toHaveValue('1.2');
  await expect(page.locator('.comparison')).toHaveCount(0);
});

test('downloads valid SVG with parameters and the selected date', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '冬至正午', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出设计单' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toContain('.svg');
  await file.saveAs(`${evidence}/design-sheet.svg`);
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const source = Buffer.concat(chunks).toString();
  expect(source).toContain('0.40 m');
  expect(source).toContain('本地实时计算 / 理想几何近似');
  expect(source).toContain('当前方案评分：91.1 / 100');
  expect(source).toContain('2026-12-22');
  expect(
    await page.evaluate(
      (s) => !new DOMParser().parseFromString(s, 'image/svg+xml').querySelector('parsererror'),
      source,
    ),
  ).toBe(true);
});

test('backend failure is visible and disables export without mock fallback', async ({ page }) => {
  await ready(page);
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await settings(page, 'api');
  await expect(page.locator('.collapsed-error')).toBeVisible();
  await page.locator('.collapsed-error').click();
  await expect(page.locator('.error-box')).toContainText('503');
  await expect(page.getByRole('button', { name: '导出设计单' })).toBeDisabled();
  await page.getByRole('tab', { name: '两至工况' }).click();
  await expect(page.locator('.metric.terra .metric-top strong')).toHaveText('—%');
});

test('narrow and short screens keep the report and controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 534 });
  await ready(page);
  await page.locator('#window_wall_ratio').fill('0.55');
  await expect(page.locator('output[for=window_wall_ratio]')).toHaveText('55%');
  await page.getByRole('button', { name: '评分与剖面', exact: true }).click();
  await expect(page.locator('#score-drawer')).toBeVisible();
  await expect(page.locator('.left-panel')).not.toBeVisible();
  await page.getByRole('tab', { name: '日期几何' }).click();
  await expect(page.locator('#date-section-drawing')).toBeVisible();
  await expect(page.locator('#date-section-drawing')).toHaveAttribute('aria-label', /2026-06-21/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/mobile.png`, fullPage: true });
});

test('late API responses cannot replace the current design score', async ({ page }) => {
  await ready(page);
  const starts: number[] = [];
  await page.route('**/api/presets', (route) => route.fulfill({ json: PRESETS }));
  await page.route('**/api/simulate', async (route) => {
    const p = route.request().postDataJSON();
    starts.push(Date.now());
    const response = localSimulate(p);
    await new Promise((resolve) => setTimeout(resolve, p.overhang_depth_m === 0.4 ? 500 : 20));
    await route.fulfill({ json: response }).catch(() => {});
  });
  await settings(page, 'api');
  await expect.poll(() => starts.length).toBeGreaterThan(0);
  await page.locator('#overhang_depth_m').fill('0');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('94.4');
  await page.waitForTimeout(650);
  await expect(page.locator('.score-capsule .score-number')).toHaveText('94.4');
  expect(starts.length).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < starts.length; i++)
    expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(65);
});

test('malformed heat data is rejected before rendering', async ({ page }) => {
  await ready(page);
  await page.route('**/api/presets', (route) => route.fulfill({ json: PRESETS }));
  await page.route('**/api/simulate', (route) =>
    route.fulfill({ json: { ...mockSimulate(DEFAULTS), heatmap_grid: [] } }),
  );
  await settings(page, 'api');
  await expect(page.locator('.collapsed-error')).toBeVisible();
  await page.locator('.collapsed-error').click();
  await expect(page.locator('.error-box')).toContainText('热力矩阵');
  await expect(page.getByRole('button', { name: '导出设计单' })).toBeDisabled();
});

test('the single standalone entry works without network or installed runtimes', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve('../夏遮冬透.html')).href);
  await expect(page.getByRole('button', { name: '导出设计单' })).toBeEnabled();
  await expect(page.locator('.statusbar')).toContainText('3D 场景就绪');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('91.1');
  await page.locator('#overhang_depth_m').fill('0');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('94.4');
  await page.getByRole('button', { name: '冬至正午', exact: true }).click();
  await expect(page.locator('input[type=date]')).toHaveValue('2026-12-22');
  await expect(page.locator('.score-capsule .score-number')).toHaveText('94.4');
  await page.getByRole('button', { name: /^重置参数与视角/ }).click();
  await expect(page.locator('.score-capsule .score-number')).toHaveText('91.1');
  expect(requests).toEqual([]);
});
