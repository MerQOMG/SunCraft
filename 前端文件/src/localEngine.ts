/** Browser implementation of backend solar/daylight/comfort_physics.
 * Fixed south-facing room contract; no network, static score or random input.
 * Parity is checked against backend-generated boundary and multi-city cases.
 */
import { EXAMPLE_ROOM as room } from './geometry';
import type { Parameters, Simulation, Optimization, Ray } from './model';
import { localScoreReport, localTotal } from './scoring/localScore';
import type { PerformanceValues } from './scoring/localScore';

const R = Math.PI / 180,
  EPS = 1e-12,
  PITCH = room.slat_pitch_m;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
interface Opening {
  height: number;
  head: number;
}
interface Sun {
  altitude: number;
  slope: number | null;
}
function opening(ratio: number): Opening {
  const height = (ratio * room.width_m * room.height_m) / room.window_width_m;
  return { height, head: room.sill_m + height };
}
function noon(latitude: number, declination: number): Sun {
  const altitude = 90 - Math.abs(latitude - declination);
  return {
    altitude,
    slope: latitude <= declination || altitude <= EPS ? null : Math.tan(altitude * R),
  };
}
function lengths(depth: number, tilt: number, slope: number) {
  return {
    canopy: depth * slope,
    slat: room.slat_chord_m * (Math.sin(tilt * R) + Math.cos(tilt * R) * slope),
  };
}
function clearLength(distance: number, slatShadow: number) {
  const shadow = Math.min(PITCH, slatShadow),
    cells = Math.floor(distance / PITCH);
  return cells * (PITCH - shadow) + Math.max(0, distance - cells * PITCH - shadow);
}
function clearFraction(window: Opening, canopy: number, slat: number) {
  return clamp(
    (clearLength(window.height, slat) - clearLength(Math.min(window.height, canopy), slat)) /
      window.height,
  );
}
function fraction(window: Opening, depth: number, tilt: number, slope: number) {
  const { canopy, slat } = lengths(depth, tilt, slope);
  return clearFraction(window, canopy, slat);
}
function highestEntry(window: Opening, canopy: number, slat: number) {
  return window.head - Math.max(canopy, Math.floor(canopy / PITCH) * PITCH + slat);
}
function rays(window: Opening, sun: Sun, depth: number, tilt: number): Ray[] {
  if (sun.slope === null) return [];
  const slope = sun.slope,
    { canopy, slat } = lengths(depth, tilt, slope),
    dx = 0.5 / Math.hypot(1, slope);
  const upstream = (x: number, z: number): [number, number] => [x - dx, z + dx * slope];
  const result: Ray[] = [],
    sample = Math.min(window.height, Math.max(canopy, slat)) / 2;
  if (sample > 0) {
    const outward = sample <= canopy ? sample / slope : sample / (slope + Math.tan(tilt * R));
    const x = -outward,
      z = window.head - sample + outward * slope;
    result.push({ kind: 'blocked', start: upstream(x, z), end: [x, z] });
  }
  if (fraction(window, depth, tilt, slope) > 0) {
    const entry = highestEntry(window, canopy, slat),
      reach = Math.min(room.depth_m, entry / slope);
    result.push({
      kind: 'transmitted',
      start: upstream(0, entry),
      window_entry: [0, entry],
      end: [reach, Math.max(0, entry - reach * slope)],
    });
  }
  return result;
}

const skySlopes = Array.from({ length: 32 }, (_, i) => {
  const u = (i + 0.5) / 32;
  return u / Math.sqrt(1 - u * u);
});
const gridCache = new Map<number, { grid: number[][]; sorted: number[]; uniformity: number }>();
function baseGrid(ratio: number) {
  const cached = gridCache.get(ratio);
  if (cached) return cached;
  const window = opening(ratio),
    floor = room.width_m * room.depth_m;
  const walls = 2 * (room.width_m + room.depth_m) * room.height_m,
    total = 2 * floor + walls,
    glazing = window.height * room.window_width_m;
  const reflectance = (0.65 * (walls - glazing) + (0.3 + 0.8) * floor) / total;
  const indirect = (((0.5 * glazing) / total) * 0.45) / (1 - reflectance);
  const grid = Array.from({ length: 24 }, (_, z) =>
    Array.from({ length: 24 }, (_, x) => {
      const depth = ((z + 0.5) * room.depth_m) / 24,
        lateral = ((x + 0.5) / 24 - 0.5) * room.width_m;
      const left = -room.window_width_m / 2 - lateral,
        right = room.window_width_m / 2 - lateral;
      const edge = (height: number) => {
        const radius = Math.hypot(depth, height);
        return (depth / (2 * radius)) * (Math.atan(right / radius) - Math.atan(left / radius));
      };
      return 100 * 0.72 * ((edge(room.sill_m) - edge(window.head)) / Math.PI + indirect);
    }),
  );
  const sorted = grid.flat().sort((a, b) => a - b),
    mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length;
  const result = { grid, sorted, uniformity: sorted[0] / mean };
  if (gridCache.size >= 32) gridCache.delete(gridCache.keys().next().value!);
  gridCache.set(ratio, result);
  return result;
}

interface Incident {
  slope: number;
  side: number;
  weight: number;
  flux: number;
}
const profileCache = new Map<string, Incident[]>();
function profile(latitude: number, summer: boolean): Incident[] {
  const key = `${latitude}:${summer}`,
    cached = profileCache.get(key);
  if (cached) return cached;
  const start = summer ? 0 : 8,
    end = summer ? 24 : 16;
  const dec = (summer ? 23.44 : -23.44) * R,
    lat = latitude * R,
    az = Math.PI;
  const points: Incident[] = [];
  for (let hour = start; hour <= end; hour += 0.25) {
    const angle = 15 * (hour - 12) * R,
      east = -Math.cos(dec) * Math.sin(angle);
    const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(angle);
    const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(angle);
    const normal = east * Math.sin(az) + north * Math.cos(az),
      side = east * Math.cos(az) - north * Math.sin(az);
    if (up > EPS && normal > EPS) {
      const weight = hour === start || hour === end ? 0.125 : 0.25;
      points.push({
        slope: up / normal,
        side: Math.abs(side / normal),
        weight,
        flux: normal * weight,
      });
    }
  }
  const totalFlux = points.reduce((sum, point) => sum + point.flux, 0);
  points.forEach((point) => {
    point.flux /= totalFlux;
  });
  if (profileCache.size >= 64) profileCache.delete(profileCache.keys().next().value!);
  profileCache.set(key, points);
  return points;
}
function exposure(window: Opening, p: Parameters) {
  let winterHours = 0,
    summerHours = 0,
    winterOpen = 0,
    summerOpen = 0;
  const winter = profile(p.latitude, false),
    summer = profile(p.latitude, true);
  for (const point of winter) {
    const { canopy, slat } = lengths(p.overhang_depth_m, p.louver_angle_deg, point.slope);
    if (canopy === 0 && slat === 0) winterHours += point.weight;
    winterOpen += clearFraction(window, canopy, slat) * point.flux;
  }
  for (const point of summer) {
    const { canopy, slat } = lengths(p.overhang_depth_m, p.louver_angle_deg, point.slope);
    summerOpen += clearFraction(window, canopy, slat) * point.flux;
    const span = (room.window_width_m + room.sofa_width_m) / 2;
    const far = Math.min(room.sofa_depth_range_m[1], span / Math.max(point.side, EPS));
    const nearDown = Math.max(0, window.head - far * point.slope);
    const farDown = Math.min(window.height, window.head - room.sofa_depth_range_m[0] * point.slope);
    if (far > room.sofa_depth_range_m[0] && farDown > nearDown) {
      const top = Math.max(nearDown, canopy);
      if (clearLength(farDown, slat) - clearLength(Math.min(top, farDown), slat) > EPS)
        summerHours += point.weight;
    }
  }
  const cooling = summer.length ? 0.7 : 0,
    heating = winter.length ? 0.3 : 0;
  const reference = cooling * 0.55 + heating * (1 - 0.55);
  const relative = reference
    ? (0.55 * (cooling * 0.75 * (1 - summerOpen) - heating * (1 - winterOpen))) / reference
    : 0;
  return { winterHours, summerHours, relative };
}
function calculate(p: Parameters) {
  const window = opening(p.window_wall_ratio),
    summer = noon(p.latitude, 23.44),
    winter = noon(p.latitude, -23.44);
  const shading =
    summer.slope === null
      ? 0
      : 1 - fraction(window, p.overhang_depth_m, p.louver_angle_deg, summer.slope);
  const gain =
    winter.slope === null
      ? 0
      : fraction(window, p.overhang_depth_m, p.louver_angle_deg, winter.slope);
  const base = baseGrid(p.window_wall_ratio),
    transmission =
      skySlopes.reduce(
        (sum, slope) => sum + fraction(window, p.overhang_depth_m, p.louver_angle_deg, slope),
        0,
      ) / 32;
  let low = 0,
    high = base.sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (base.sorted[mid] * transmission >= 2) high = mid;
    else low = mid + 1;
  }
  const compliance = (base.sorted.length - low) / base.sorted.length;
  const shadow =
    winter.slope === null ? null : lengths(p.overhang_depth_m, p.louver_angle_deg, winter.slope);
  const penetration =
    gain > 0 && shadow && winter.slope !== null
      ? Math.min(room.depth_m, highestEntry(window, shadow.canopy, shadow.slat) / winter.slope)
      : 0;
  const seasonal = exposure(window, p);
  const values: PerformanceValues = {
    summer_shading_rate: shading,
    wwr: p.window_wall_ratio,
    shgc: 0.55 * (1 - 0.75 * shading),
    winter_solar_gain_rate: gain,
    winter_penetration_m: penetration,
    winter_full_window_hours: seasonal.winterHours,
    daylight_compliance_rate: compliance,
    daylight_uniformity: transmission > 0 ? base.uniformity : 0,
    window_floor_ratio: (window.height * room.window_width_m) / (room.width_m * room.depth_m),
    sofa_summer_hours: seasonal.summerHours,
    relative_load_reduction: seasonal.relative,
  };
  return { window, summer, winter, base, transmission, values };
}
export function localSimulate(p: Parameters): Simulation {
  const { window, summer, winter, base, transmission, values } = calculate(p);
  return {
    score_report: localScoreReport(values),
    solar_angles: { summer_noon_alt: summer.altitude, winter_noon_alt: winter.altitude },
    metrics: {
      summer_shading_rate: values.summer_shading_rate,
      winter_solar_gain_rate: values.winter_solar_gain_rate,
      daylight_compliance_rate: values.daylight_compliance_rate,
      is_gb_compliant: values.daylight_compliance_rate >= 0.8,
      winter_penetration_m: values.winter_penetration_m,
    },
    heatmap_grid: base.grid.map((row) => row.map((value) => value * transmission)),
    svg_rays: {
      summer_incident: summer.slope !== null,
      winter_incident: winter.slope !== null,
      summer_blocked: summer.slope !== null && values.summer_shading_rate === 1,
      winter_hit_depth: values.winter_penetration_m,
      summer: rays(window, summer, p.overhang_depth_m, p.louver_angle_deg),
      winter: rays(window, winter, p.overhang_depth_m, p.louver_angle_deg),
    },
  };
}
export function localOptimize(p: Parameters): Optimization {
  const before = localSimulate(p);
  let best: Parameters | null = before.metrics.daylight_compliance_rate >= 0.8 ? { ...p } : null;
  let bestScore = best ? before.score_report!.total_score! : -Infinity;
  let bestCompliance = best ? before.metrics.daylight_compliance_rate : -Infinity;
  let maxCompliance = before.metrics.daylight_compliance_rate;
  const isCurrent = (q: Parameters) =>
    q.overhang_depth_m === p.overhang_depth_m && q.louver_angle_deg === p.louver_angle_deg;
  // Same 37 × 81 studio grid and tie-breaking rules as backend optimization.py.
  for (let d = 0; d <= 36; d++)
    for (let tilt = 0; tilt <= 80; tilt++) {
      const candidate = { ...p, overhang_depth_m: d / 20, louver_angle_deg: tilt };
      const { values } = calculate(candidate),
        compliance = values.daylight_compliance_rate;
      maxCompliance = Math.max(maxCompliance, compliance);
      if (compliance < 0.8) continue;
      const score = localTotal(values);
      const tieBetter =
        best &&
        (isCurrent(candidate) !== isCurrent(best)
          ? isCurrent(candidate)
          : compliance !== bestCompliance
            ? compliance > bestCompliance
            : candidate.overhang_depth_m !== best.overhang_depth_m
              ? candidate.overhang_depth_m < best.overhang_depth_m
              : candidate.louver_angle_deg < best.louver_angle_deg);
      if (!best || score > bestScore || (score === bestScore && tieBetter)) {
        best = candidate;
        bestScore = score;
        bestCompliance = compliance;
      }
    }
  if (!best)
    throw Error(
      `当前窗墙比下没有满足采光目标的候选（最大面积比例${(maxCompliance * 100).toFixed(1)}%，目标80.0%）；请调整窗墙比后重试。`,
    );
  return { parameters: best, before, after: localSimulate(best) };
}
