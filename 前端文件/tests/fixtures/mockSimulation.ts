import { EXAMPLE_ROOM, windowGeometry as contractWindowGeometry } from '../../src/geometry';
import type { Parameters, Simulation, Optimization } from '../../src/model';
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

/** Mock-only convenience: explicit offline metadata snapshot, not a live API fallback. */
export function windowGeometry(ratio: number) {
  return contractWindowGeometry(ratio, EXAMPLE_ROOM);
}
// Illustrative response generator, NOT the FastAPI physics model or a compliance certificate.
export function mockSimulate(p: Parameters, threshold = 2): Simulation {
  const shade = clamp(
    0.12 + p.overhang_depth_m * 0.43 + Math.sin((p.louver_angle_deg * Math.PI) / 180) * 0.38,
  );
  const winter = clamp(0.97 - p.overhang_depth_m * 0.14 - p.louver_angle_deg * 0.004);
  const grid = Array.from({ length: 24 }, (_, z) =>
    Array.from({ length: 24 }, (_, x) =>
      Number(
        (
          0.25 +
          8.8 *
            p.window_wall_ratio *
            Math.exp(-z / 19) *
            (1 - 0.27 * p.overhang_depth_m) *
            (1 - p.louver_angle_deg / 190) *
            (1 - (0.13 * Math.abs(x - 11.5)) / 11.5)
        ).toFixed(3),
      ),
    ),
  );
  const day = grid.flat().filter((v) => v >= threshold).length / 576;
  const winterAlt = 90 - p.latitude - 23.44;
  return {
    solar_angles: {
      summer_noon_alt: 90 - Math.abs(p.latitude - 23.44),
      winter_noon_alt: winterAlt,
    },
    metrics: {
      summer_shading_rate: shade,
      winter_solar_gain_rate: winter,
      daylight_compliance_rate: day,
      is_gb_compliant: day >= 0.8,
      winter_penetration_m:
        Math.min(
          6,
          windowGeometry(p.window_wall_ratio).top / Math.tan((winterAlt * Math.PI) / 180),
        ) * winter,
    },
    heatmap_grid: grid,
    svg_rays: {
      summer_blocked: shade > 0.75,
      winter_hit_depth:
        Math.min(
          6,
          windowGeometry(p.window_wall_ratio).top / Math.tan((winterAlt * Math.PI) / 180),
        ) * winter,
    },
  };
}
export function mockOptimize(p: Parameters): Optimization {
  let best = { ...p };
  let score = -Infinity;
  for (let d = 0; d <= 1.801; d += 0.1)
    for (let a = 0; a <= 80; a += 5) {
      const q = { ...p, overhang_depth_m: Number(d.toFixed(2)), louver_angle_deg: a };
      const m = mockSimulate(q).metrics;
      const s =
        0.48 * m.summer_shading_rate +
        0.32 * m.winter_solar_gain_rate +
        0.2 * m.daylight_compliance_rate -
        1.5 * Math.max(0, 0.8 - m.daylight_compliance_rate);
      if (s > score) {
        score = s;
        best = q;
      }
    }
  return { parameters: best, before: mockSimulate(p), after: mockSimulate(best) };
}
