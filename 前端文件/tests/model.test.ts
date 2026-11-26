import { EXAMPLE_ROOM, shadeGeometry } from '../src/geometry';
import { describe, it, expect } from 'vitest';
import { DEFAULTS, PRESETS } from '../src/model';
import { mockSimulate, mockOptimize, windowGeometry } from './fixtures/mockSimulation';
import { validateSimulation, validatePresets, validateOptimization } from '../src/api';
import { designSheet, escapeXml } from '../src/export';
describe('room and mock contract', () => {
  it('defaults to Shanghai and a shallow 0.4m overhang', () => {
    expect(DEFAULTS.latitude).toBe(31.2);
    expect(DEFAULTS.overhang_depth_m).toBe(0.4);
    expect(mockSimulate(DEFAULTS).metrics.summer_shading_rate).toBeLessThan(0.65);
  });
  it('changes window height, not room or window width', () => {
    for (const r of [0.25, 0.45, 0.65]) {
      const w = windowGeometry(r);
      expect((w.width * w.height) / (5.4 * 3)).toBeCloseTo(r);
      expect(w.top).toBeLessThan(3);
      expect(w.sill).toBeGreaterThan(0);
    }
  });
  it('creates finite 24×24 row-major DF percentage-point data', () => {
    const s = mockSimulate(DEFAULTS);
    expect(validateSimulation(s)).toEqual(s);
    expect(s.heatmap_grid).toHaveLength(24);
    expect(s.heatmap_grid[0][12]).toBeGreaterThan(s.heatmap_grid[23][12]);
    expect(s.solar_angles.summer_noon_alt).toBeCloseTo(82.24);
  });
  it('larger shading reduces mock winter gain and daylight', () => {
    const a = mockSimulate(DEFAULTS),
      b = mockSimulate({ ...DEFAULTS, overhang_depth_m: 1.8, louver_angle_deg: 80 });
    expect(b.metrics.summer_shading_rate).toBeGreaterThan(a.metrics.summer_shading_rate);
    expect(b.metrics.winter_solar_gain_rate).toBeLessThan(a.metrics.winter_solar_gain_rate);
    expect(b.heatmap_grid[2][2]).toBeLessThan(a.heatmap_grid[2][2]);
  });
  it('does not guarantee compliance for a constrained solution', () => {
    const p = { ...DEFAULTS, window_wall_ratio: 0.25 };
    const opt = mockOptimize(p);
    expect(opt.parameters.window_wall_ratio).toBe(0.25);
    expect(opt.after.metrics.is_gb_compliant).toBe(false);
    expect(validateOptimization(opt, p)).toEqual(opt);
  });
  it('keeps city and WWR fixed during optimization', () => {
    const opt = mockOptimize(DEFAULTS);
    expect(opt.parameters.latitude).toBe(DEFAULTS.latitude);
    expect(opt.parameters.city_id).toBe(DEFAULTS.city_id);
    expect(opt.parameters.window_wall_ratio).toBe(DEFAULTS.window_wall_ratio);
    expect(opt.parameters.overhang_depth_m).toBeGreaterThanOrEqual(0);
  });
});
describe('untrusted API responses', () => {
  it('validates supplied preset shapes', () => {
    expect(validatePresets(PRESETS)).toEqual(PRESETS);
    expect(() => validatePresets({ cities: [], daylight_threshold_pct: 2 })).toThrow();
  });
  it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid metric %s', (n) => {
    const s = mockSimulate(DEFAULTS);
    s.metrics.summer_shading_rate = n;
    expect(() => validateSimulation(s)).toThrow();
  });
  it('rejects malformed heatmap', () => {
    const s = mockSimulate(DEFAULTS);
    s.heatmap_grid[0] = [];
    expect(() => validateSimulation(s)).toThrow(/矩阵/);
  });
  it('rejects out-of-bounds optimum', () => {
    const opt = mockOptimize(DEFAULTS);
    opt.parameters.overhang_depth_m = 20;
    expect(() => validateOptimization(opt, DEFAULTS)).toThrow();
  });
  it('rejects a changed WWR constraint', () => {
    const opt = mockOptimize(DEFAULTS);
    opt.parameters.window_wall_ratio = 0.3;
    expect(() => validateOptimization(opt, DEFAULTS)).toThrow(/约束/);
  });
});
describe('SVG export', () => {
  it('escapes external names and includes parameter units and provenance', () => {
    const out = designSheet(
      DEFAULTS,
      mockSimulate(DEFAULTS),
      '<svg viewBox="0 0 370 256"></svg>',
      '<script>& city',
      '演示 / 近似数据',
    );
    expect(out).toContain('&lt;script&gt;&amp; city');
    expect(out).toContain('0.40 m');
    expect(out).toContain('Asia/Shanghai');
    expect(out).toContain('不是物理精度');
    expect(out).toContain('x="78" y="190"');
  });
  it('escapes every XML delimiter', () => {
    expect(escapeXml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&apos;');
  });
});

// These check geometry numerically; they are not a substitute for browser visual review.
import { solarNoon, southWindowRay } from '../src/solar';
describe('shared solar-noon geometry', () => {
  it.each(['summer', 'winter'] as const)(
    'has zero east component and exact altitude in %s',
    (season) => {
      const s = solarNoon(31.2, season),
        d = s.direction;
      expect(d.x).toBe(0);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 12);
      expect((Math.asin(d.y) * 180) / Math.PI).toBeCloseTo(s.altitude, 10);
      expect(d.z).toBeLessThan(0);
    },
  );
  it('uses 82.24/35.36 degrees for Shanghai without moving the demonstration time', () => {
    expect(solarNoon(31.2, 'summer').altitude).toBeCloseTo(82.24);
    expect(solarNoon(31.2, 'winter').altitude).toBeCloseTo(35.36);
  });
  it('places Guangzhou summer-noon sun north, not south of the room', () => {
    const s = solarNoon(23.1, 'summer');
    expect(s.altitude).toBeCloseTo(89.66);
    expect(s.direction.z).toBeGreaterThan(0);
    expect(s.south).toBe(false);
    expect(southWindowRay(2.3, 23.1, 'summer').depth).toBe(0);
  });
  it('does not redirect a geometric ray to an independent heuristic metric', () => {
    const top = windowGeometry(DEFAULTS.window_wall_ratio).top,
      ray = southWindowRay(top, 31.2, 'winter');
    expect((Math.atan2(top, ray.depth) * 180) / Math.PI).toBeCloseTo(ray.altitude, 10);
    expect(ray.depth).not.toBeCloseTo(mockSimulate(DEFAULTS).svg_rays.winter_hit_depth, 2);
  });
  it('uses synchronized API altitudes without adding an azimuth offset', () => {
    const s = solarNoon(31.2, 'summer', { summer_noon_alt: 82.2, winter_noon_alt: 35.4 });
    expect(s.altitude).toBe(82.2);
    expect(s.direction.x).toBe(0);
  });
  it('removes responsive SVG width styles inside the fixed design sheet viewport', () => {
    const out = designSheet(
      DEFAULTS,
      mockSimulate(DEFAULTS),
      '<svg style="width: 100%; height: auto; font-family: Arial;" viewBox="0 0 370 256"></svg>',
      '上海',
      '演示 / 近似数据',
    );
    expect(out).not.toContain('width: 100%');
    expect(out).toContain('width="964" height="650"');
  });
});

import { VISUAL_CONSTRUCTION, FINISH, sofaFoot } from '../src/shading';
describe('R3 construction diagnosis', () => {
  it('uses head-periodic 60mm ideal blades with separately declared decorative thickness', () => {
    expect(EXAMPLE_ROOM.slat_chord_m).toBe(0.06);
    expect(EXAMPLE_ROOM.slat_pitch_m).toBe(0.45);
    expect(VISUAL_CONSTRUCTION.bladeThickness_m).toBe(0.012);
    expect(shadeGeometry(DEFAULTS, EXAMPLE_ROOM).blades).toHaveLength(4);
  });
  it('tilts the outer edge down for a positive angle', () => {
    const g = shadeGeometry({ ...DEFAULTS, louver_angle_deg: 30 }, EXAMPLE_ROOM);
    expect(g.blades[0].outerHeight).toBeLessThan(g.blades[0].rootHeight);
    expect(g.blades[0].outerDepth).toBeLessThan(0);
  });
  it('hides zero-depth canopies rather than leaving a residual strip', () => {
    expect(shadeGeometry({ ...DEFAULTS, overhang_depth_m: 0 }, EXAMPLE_ROOM).canopy.visible).toBe(
      false,
    );
  });
  it('puts rug and both sofa leg lengths in contact instead of floating', () => {
    expect(FINISH.floorTop_m + FINISH.rugThickness_m).toBeCloseTo(FINISH.rugTop_m);
    for (const rug of [true, false]) {
      const f = sofaFoot(rug);
      expect(f.center - f.height / 2).toBeCloseTo(rug ? FINISH.rugTop_m : FINISH.floorTop_m);
      expect(f.center + f.height / 2).toBeCloseTo(FINISH.sofaLegTop_m);
    }
  });
  it('does not alter the demonstration metric meaning with a visual construction change', () => {
    const s = mockSimulate(DEFAULTS);
    expect(s.metrics.summer_shading_rate).toBeCloseTo(0.292);
    expect(s.metrics.winter_solar_gain_rate).toBeCloseTo(0.914);
    expect(s.heatmap_grid).toHaveLength(24);
  });
});
