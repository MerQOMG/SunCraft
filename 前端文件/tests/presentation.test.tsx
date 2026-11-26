import { EXAMPLE_ROOM } from '../src/geometry';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import Section from '../src/components/Section';
import { INK, wrapLabel, FONT_STACK } from '../src/presentation';
import { designSheet } from '../src/export';
import { DEFAULTS } from '../src/model';
import { mockSimulate } from './fixtures/mockSimulation';
const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const luminance = (hex: string) =>
  hex
    .slice(1)
    .match(/../g)!
    .map((n) => parseInt(n, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((a, n, i) => a + n * [0.2126, 0.7152, 0.0722][i], 0);
const result = mockSimulate(DEFAULTS);
const section = renderToStaticMarkup(
  <Section room={EXAMPLE_ROOM} parameters={DEFAULTS} result={result} season="winter" />,
);
describe('P3 readable presentation (pure checks, not browser validation)', () => {
  it('gives all normal text inks at least 4.5:1 contrast on the panel paper', () => {
    const background = luminance(INK.paper);
    for (const key of ['text', 'muted', 'forest', 'summer', 'winter', 'daylight'] as const)
      expect((background + 0.05) / (luminance(INK[key]) + 0.05), key).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps CSS, SVG, and exported sheet using matching inks and fonts', () => {
    for (const key of ['text', 'muted', 'paper', 'forest', 'summer', 'winter', 'daylight'] as const)
      expect(css).toContain(INK[key]);
    expect(section).toContain(FONT_STACK);
    expect(section).toContain(INK.summer);
    expect(section).toContain(INK.winter);
  });
  it('keeps correct geometry and labels with larger SVG text, including north-side summer sun', () => {
    expect(section).toContain('夏至 82.2°');
    expect(section).toContain('冬至 35.4°');
    expect(section).toContain('6 000 mm');
    expect(section).toContain('font-size="20"');
    const northParameters = { ...DEFAULTS, latitude: 23.1 };
    const north = renderToStaticMarkup(
      <Section
        room={EXAMPLE_ROOM}
        parameters={northParameters}
        result={mockSimulate(northParameters)}
        season="summer"
      />,
    );
    expect(north).toContain('89.7° / 北侧');
    const waiting = renderToStaticMarkup(
      <Section room={EXAMPLE_ROOM} parameters={northParameters} result={null} season="summer" />,
    );
    expect(waiting).toContain('工况结果未就绪');
    expect(waiting).not.toContain('89.7°');
  });
  it('wraps long CJK or unbroken names without dropping characters', () => {
    const name = '长项目名称ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8),
      lines = wrapLabel(name, 25);
    expect(lines.join('')).toBe(name);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines)
      expect(
        [...line].reduce((sum, c) => sum + (c.codePointAt(0)! < 128 ? 0.56 : 1), 0),
      ).toBeLessThanOrEqual(25);
  });
  it('exports the configured DF threshold, 80% target and unchanged geometric diagram bounds', () => {
    const sheet = designSheet(DEFAULTS, result, section, '上海', '演示 / 近似数据', 3.5);
    expect(sheet).toContain('DF ≥ 3.5%');
    expect(sheet).toContain('面积目标 80%');
    expect(sheet).toContain('width="964" height="650"');
    expect(sheet).toContain('y="881"');
    expect(sheet).toContain('y="916"');
    expect(sheet).toContain('GB 50033');
    expect(sheet).toContain('不是真实帕累托解');
  });
  it('grows the sheet for wrapped external labels rather than overlapping its footer', () => {
    const name = '<外部项目&名称>很长'.repeat(24),
      sheet = designSheet(DEFAULTS, result, section, name, '后端计算 / 待专业校核');
    expect(sheet).not.toContain('<外部项目');
    expect(sheet).toContain('&lt;外部项目&amp;');
    const height = Number(sheet.match(/width="1120" height="(\d+)"/)![1]);
    expect(height).toBeGreaterThan(1400);
    const ys = [...sheet.matchAll(/<text x="78" y="(\d+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThan(height);
    expect(ys.filter((y) => y >= 916).every((y) => y > 840)).toBe(true);
  });
  it('retains narrow-screen export and reset safe space without a blocking footer', () => {
    expect(app).toContain('aria-label="导出设计单"');
    expect(app).toContain('export-label-short');
    expect(app.replace(/\s+/g, '')).toContain('>导出</span>');
    expect(css).toMatch(/min-width:\s*68px/);
    expect(css).toContain('calc(100px + env(safe-area-inset-bottom))');
    expect(css).toMatch(/\.statusbar\s*\{[^}]*position:\s*fixed[^}]*pointer-events:\s*none/);
  });
  it('does not reintroduce microtype or scene-caption background blur', () => {
    const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    expect(css).not.toContain('blur(');
    expect(app).not.toContain('className="room-label"');
    expect(app).toContain('GB 50033 判定');
  });
});
