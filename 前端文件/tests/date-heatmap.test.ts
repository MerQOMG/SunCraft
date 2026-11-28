import { describe, it, expect } from 'vitest';
import { annualSolarFrame, SUMMER_DAY, WINTER_DAY, dayFromDate } from '../src/annual';
import { dateHeatmap } from '../src/dateHeatmap';
import { dateHeatmapColor } from '../src/heatmap';
import { EXAMPLE_ROOM } from '../src/geometry';
import { DEFAULTS } from '../src/model';
import { localSimulate, localOptimize } from '../src/localEngine';

describe('date-dependent floor light, kept separate from uniform-sky DF', () => {
  it('moves direct exposure with the selected date without mutating the source DF', () => {
    const df = localSimulate(DEFAULTS).heatmap_grid,
      snapshot = structuredClone(df);
    const summer = dateHeatmap(DEFAULTS, EXAMPLE_ROOM, annualSolarFrame(SUMMER_DAY, 31.2), df);
    const winter = dateHeatmap(DEFAULTS, EXAMPLE_ROOM, annualSolarFrame(WINTER_DAY, 31.2), df);
    expect(summer.grid).not.toEqual(winter.grid);
    expect(summer.directAreaFraction).toBe(0);
    expect(winter.directAreaFraction).toBeGreaterThan(0);
    expect(winter.mean).toBeGreaterThan(summer.mean);
    expect(df).toEqual(snapshot);
  });
  it('handles Guangzhou north-side summer sun and south-side winter sun without flipping it', () => {
    const p = { ...DEFAULTS, city_id: 'guangzhou', latitude: 23.1 },
      df = localSimulate(p).heatmap_grid;
    const summerFrame = annualSolarFrame(SUMMER_DAY, p.latitude);
    expect(summerFrame.south).toBe(false);
    const summer = dateHeatmap(p, EXAMPLE_ROOM, summerFrame, df);
    const winter = dateHeatmap(p, EXAMPLE_ROOM, annualSolarFrame(WINTER_DAY, p.latitude), df);
    expect(summer.southIncident).toBe(false);
    expect(summer.directAreaFraction).toBe(0);
    expect(summer.mean).toBeGreaterThan(0); // Sky remains visible even without a direct beam.
    expect(winter.southIncident).toBe(true);
    expect(winter.directAreaFraction).toBeGreaterThan(0);
  });
  it('responds to actual shade geometry at the same date', () => {
    const frame = annualSolarFrame(WINTER_DAY, 31.2);
    const shallow = { ...DEFAULTS, overhang_depth_m: 0 };
    const deep = { ...DEFAULTS, overhang_depth_m: 1.8 };
    const a = dateHeatmap(shallow, EXAMPLE_ROOM, frame, localSimulate(shallow).heatmap_grid);
    const b = dateHeatmap(deep, EXAMPLE_ROOM, frame, localSimulate(deep).heatmap_grid);
    expect(b.directAreaFraction).toBeLessThan(a.directAreaFraction);
    expect(b.mean).toBeLessThan(a.mean);
  });
  it('is finite through the zenith crossing, bounds, polar night and rectangular input', () => {
    for (const latitude of [23.1, 23.44, 31.2, 90])
      for (const date of ['2026-06-05', '2026-06-21', '2026-07-07', '2026-12-22']) {
        const p = { ...DEFAULTS, latitude },
          frame = annualSolarFrame(dayFromDate(date)!, latitude);
        const result = dateHeatmap(p, EXAMPLE_ROOM, frame, [
          [2, 3, 4],
          [1, 2, 3],
        ]);
        expect(result.grid.flat().every((n) => Number.isFinite(n) && n >= 0 && n <= 100)).toBe(
          true,
        );
        if (!frame.aboveHorizon) expect(result.max).toBe(0);
      }
  });
  it('keeps one fixed color scale instead of exaggerating a dim date to full brightness', () => {
    expect(dateHeatmapColor(0)).toBe(dateHeatmapColor(-1));
    expect(dateHeatmapColor(100)).toBe(dateHeatmapColor(200));
    expect(dateHeatmapColor(1)).not.toBe(dateHeatmapColor(70));
  });
});

describe('Guangzhou applicability in the live local report', () => {
  it('does not punish a nonincident summer beam as a failed shade or fabricate a 100% physical rate', () => {
    const p = { ...DEFAULTS, city_id: 'guangzhou', latitude: 23.1 };
    const result = localSimulate(p),
      items = result.score_report!.dimensions[0].items;
    expect(result.svg_rays.summer_incident).toBe(false);
    expect(result.metrics.summer_shading_rate).toBe(0);
    expect(result.svg_rays.summer).toEqual([]);
    expect(items[0].score).toBe(20);
    expect(items[0].status).toBe('pass');
    expect(items[0].value_display).toContain('无正面直射');
    expect(items[1].score).toBe(15);
    expect(
      localSimulate({ ...p, window_wall_ratio: 0.65 }).score_report!.dimensions[0].items[1].score,
    ).toBeLessThan(15);
    const optimum = localOptimize(p);
    expect(optimum.after.score_report!.total_score!).toBeGreaterThanOrEqual(
      result.score_report!.total_score!,
    );
    expect(optimum.after).toEqual(localSimulate(optimum.parameters));
  });
});
