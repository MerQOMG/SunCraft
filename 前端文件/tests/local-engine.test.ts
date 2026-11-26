import { describe, it, expect } from 'vitest';
import reference from './fixtures/backend-scoring-reference.json';
import { localSimulate, localOptimize } from '../src/localEngine';
import { DEFAULTS } from '../src/model';
import { validateSimulation, api } from '../src/api';
import { adaptScoreReport } from '../src/scoring/report';
import { designSheet } from '../src/export';

describe('local realtime scoring agrees with the owning backend', () => {
  for (const { parameters, expected } of reference.cases) {
    it(`${parameters.city_id} depth=${parameters.overhang_depth_m}, tilt=${parameters.louver_angle_deg}, wwr=${parameters.window_wall_ratio}`, () => {
      const actual = localSimulate(parameters);
      expect(validateSimulation(actual)).toEqual(actual);
      for (const key of [
        'summer_shading_rate',
        'winter_solar_gain_rate',
        'daylight_compliance_rate',
        'winter_penetration_m',
      ] as const) {
        expect(actual.metrics[key]).toBeCloseTo(expected.metrics[key], 9);
      }
      expect(actual.metrics.is_gb_compliant).toBe(expected.metrics.is_gb_compliant);
      expect(actual.svg_rays.summer_incident).toBe(expected.svg_rays.summer_incident);
      expect(actual.svg_rays.winter_hit_depth).toBeCloseTo(expected.svg_rays.winter_hit_depth, 9);
      const samples = [
        [0, 0],
        [0, 12],
        [12, 12],
        [23, 23],
      ].map(([z, x]) => actual.heatmap_grid[z][x]);
      samples.forEach((value, i) => expect(value).toBeCloseTo(expected.heatmap_samples[i], 9));
      expect(actual.score_report!.total_score).toBeCloseTo(expected.score_report.total_score, 5);
      expect(actual.score_report!.grade).toBe(expected.score_report.grade);
      const items = actual.score_report!.dimensions.flatMap((d) => d.items);
      const expectedItems = expected.score_report.dimensions.flatMap((d) => d.items);
      expect(items).toHaveLength(10);
      items.forEach((item, i) => {
        expect(item.key).toBe(expectedItems[i].key);
        expect(item.score).toBeCloseTo(expectedItems[i].score!, 5);
        expect(item.status).toBe(expectedItems[i].status);
        expect(item.threshold_display).toBe(expectedItems[i].threshold_display);
      });
      expect(adaptScoreReport(actual.score_report).provenance).toBe('local');
    });
  }
  for (const { parameters, status, best } of reference.optimization_cases) {
    it(`optimization uses report total, constraints and backend tie-breaking: ${parameters.city_id}/${parameters.window_wall_ratio}`, () => {
      if (status === 'infeasible') {
        expect(() => localOptimize(parameters)).toThrow(/采光目标/);
        return;
      }
      const actual = localOptimize(parameters);
      expect(actual.parameters.overhang_depth_m).toBe(best!.overhang_depth_m);
      expect(actual.parameters.louver_angle_deg).toBe(best!.louver_angle_deg);
      expect(actual.after.score_report!.total_score).toBeCloseTo(best!.total_score, 5);
      expect(actual.parameters.window_wall_ratio).toBe(parameters.window_wall_ratio);
      expect(actual.after).toEqual(localSimulate(actual.parameters));
      expect(actual.after.score_report!.total_score!).toBeGreaterThanOrEqual(
        actual.before.score_report!.total_score!,
      );
    });
  }
  it('updates report and all contributions for the actual current parameters in offline mode', async () => {
    const config = { mode: 'mock' as const, baseUrl: 'http://127.0.0.1:8001' };
    const signal = new AbortController().signal;
    const initial = await api.simulate(DEFAULTS, config, signal);
    const changed = await api.simulate(
      { ...DEFAULTS, overhang_depth_m: 1.8, louver_angle_deg: 80 },
      config,
      signal,
    );
    expect(changed.score_report!.total_score).not.toBe(initial.score_report!.total_score);
    expect(changed.score_report!.provenance).toBe('local');
    for (const result of [initial, changed]) {
      const sum = result
        .score_report!.dimensions.flatMap((d) => d.items)
        .reduce((total, item) => total + item.score!, 0);
      expect(result.score_report!.total_score).toBeCloseTo(sum, 5);
    }
  });
  it('exports the score of this exact design with its four dimension totals', () => {
    const result = localSimulate(DEFAULTS);
    const svg = designSheet(DEFAULTS, result, '<svg></svg>', '上海', '本地实时计算 / 理想几何近似');
    expect(svg).toContain('当前方案评分：91.1 / 100');
    expect(svg).toContain('本地实时计算');
    for (const dimension of result.score_report!.dimensions) expect(svg).toContain(dimension.name);
    expect(svg).not.toContain('88.4');
  });
});
