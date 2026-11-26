import { validRoom } from './geometry';
import { networkErrorMessage } from './analysisCopy';
import { adaptScoreReport } from './scoring/report';
import { PRESETS, LIMITS } from './model';
import { localSimulate, localOptimize } from './localEngine';
import type { Parameters, Presets, Simulation, Optimization } from './model';
export interface TransportConfig {
  mode: 'mock' | 'api';
  baseUrl: string;
}
// HTTP development uses the same-origin API; standalone HTML uses the local model.
const pageOrigin =
  typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
    ? window.location.origin
    : '';
const envMode =
  import.meta.env.VITE_DATA_MODE === 'mock'
    ? 'mock'
    : import.meta.env.VITE_DATA_MODE === 'api' || pageOrigin
      ? 'api'
      : 'mock';
export const initialConfig: TransportConfig = {
  mode: envMode,
  baseUrl: import.meta.env.VITE_API_BASE_URL || pageOrigin || 'http://127.0.0.1:8001',
};
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}
function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
export function validateSimulation(v: unknown): Simulation {
  if (!object(v) || !object(v.metrics) || !object(v.solar_angles) || !object(v.svg_rays))
    throw Error('模拟响应缺少必要字段');
  const m = v.metrics,
    a = v.solar_angles,
    r = v.svg_rays;
  for (const k of ['summer_shading_rate', 'winter_solar_gain_rate', 'daylight_compliance_rate'])
    if (!num(m[k]) || m[k] < 0 || m[k] > 1) throw Error('指标必须是 0–1 的有限数值');
  if (
    !num(m.winter_penetration_m) ||
    m.winter_penetration_m < 0 ||
    m.winter_penetration_m > 6 ||
    typeof m.is_gb_compliant !== 'boolean' ||
    !num(a.summer_noon_alt) ||
    !num(a.winter_noon_alt) ||
    a.summer_noon_alt < 0 ||
    a.summer_noon_alt > 90 ||
    a.winter_noon_alt < 0 ||
    a.winter_noon_alt > 90 ||
    typeof r.summer_blocked !== 'boolean' ||
    !num(r.winter_hit_depth) ||
    r.winter_hit_depth < 0 ||
    r.winter_hit_depth > 6
  )
    throw Error('角度、深度或状态格式无效');
  if (
    !Array.isArray(v.heatmap_grid) ||
    v.heatmap_grid.length < 2 ||
    v.heatmap_grid.length > 256 ||
    !Array.isArray(v.heatmap_grid[0]) ||
    v.heatmap_grid[0].length < 2 ||
    v.heatmap_grid[0].length > 256 ||
    !v.heatmap_grid.every(
      (row) =>
        Array.isArray(row) &&
        row.length === (v.heatmap_grid as number[][])[0].length &&
        row.every((n) => num(n) && n >= 0),
    )
  )
    throw Error('热力矩阵需为 2–256 行/列的矩形非负数值');
  for (const season of ['summer', 'winter'])
    if (r[season] !== undefined) {
      const rays = r[season];
      const point = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(num);
      if (
        !Array.isArray(rays) ||
        rays.length > 16 ||
        !rays.every(
          (ray) =>
            object(ray) &&
            ['blocked', 'transmitted'].includes(String(ray.kind)) &&
            point(ray.start) &&
            point(ray.end) &&
            (ray.window_entry == null || point(ray.window_entry)),
        )
      )
        throw Error('后端剖面射线格式无效');
    }
  const clean = { ...v } as unknown as Simulation;
  delete clean.score_report;
  delete clean.score_report_error;
  if (v.score_report !== undefined && v.score_report !== null) {
    try {
      clean.score_report = adaptScoreReport(v.score_report);
    } catch (e) {
      clean.score_report_error = e instanceof Error ? e.message : '评分报告无效';
    }
  }
  return clean;
}
export function validatePresets(v: unknown): Presets {
  if (
    !object(v) ||
    !Array.isArray(v.cities) ||
    v.cities.length === 0 ||
    !v.cities.every(
      (c) =>
        object(c) &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        num(c.latitude) &&
        c.latitude >= 23 &&
        c.latitude <= 50,
    ) ||
    !num(v.daylight_threshold_pct) ||
    v.daylight_threshold_pct <= 0
  )
    throw Error('城市预设响应格式无效');
  const clean = { ...v } as unknown as Presets;
  delete clean.geometry_error;
  if (v.room !== undefined && validRoom(v.room)) clean.room = v.room;
  else {
    delete clean.room;
    clean.geometry_error = '几何契约未同步：缺少或不支持room元数据，三维预览暂停';
  }
  return clean;
}
export function validateOptimization(v: unknown, p: Parameters): Optimization {
  if (!object(v) || !object(v.parameters)) throw Error('寻优响应缺少 parameters');
  const q = v.parameters;
  for (const [key, range] of Object.entries(LIMITS))
    if (!num(q[key]) || q[key] < range.min || q[key] > range.max)
      throw Error('寻优参数超出约定范围');
  if (
    q.city_id !== p.city_id ||
    q.latitude !== p.latitude ||
    q.window_wall_ratio !== p.window_wall_ratio
  )
    throw Error('寻优不应改变城市或窗墙比约束');
  return {
    parameters: q as unknown as Parameters,
    before: validateSimulation(v.before),
    after: validateSimulation(v.after),
  };
}
async function request(
  config: TransportConfig,
  path: string,
  signal: AbortSignal,
  payload?: unknown,
): Promise<unknown> {
  const timeout = new AbortController();
  const id = setTimeout(() => timeout.abort(new Error('请求超时（8 秒）')), 8000);
  const cancel = () => timeout.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: timeout.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail = object(body) ? body.detail : null;
      if (
        response.status === 409 &&
        object(detail) &&
        detail.reason === 'daylight_target_unreachable'
      ) {
        const best = detail.max_daylight_compliance_rate,
          required = detail.required_daylight_compliance_rate;
        const rates =
          num(best) && num(required)
            ? `（最大面积比例${(best * 100).toFixed(1)}%，目标${(required * 100).toFixed(1)}%）`
            : '';
        throw Error(`当前窗墙比下没有满足采光目标的候选${rates}；请调整窗墙比后重试。HTTP 409`);
      }
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && object(detail[0]) && typeof detail[0].msg === 'string'
            ? detail[0].msg
            : object(detail) && typeof detail.reason === 'string'
              ? detail.reason
              : '';
      throw Error(`后端响应 HTTP ${response.status}${message ? `：${message.slice(0, 400)}` : ''}`);
    }
    return await response.json();
  } catch (error) {
    if (timeout.signal.aborted && !signal.aborted) throw Error('后端响应超时（8 秒），请检查服务');
    if (signal.aborted) throw error;
    throw Error(networkErrorMessage(error));
  } finally {
    clearTimeout(id);
    signal.removeEventListener('abort', cancel);
  }
}
const abortCheck = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
};
export const api = {
  async presets(c: TransportConfig, s: AbortSignal): Promise<Presets> {
    abortCheck(s);
    return c.mode === 'mock' ? PRESETS : validatePresets(await request(c, '/api/presets', s));
  },
  async simulate(p: Parameters, c: TransportConfig, s: AbortSignal): Promise<Simulation> {
    abortCheck(s);
    return c.mode === 'mock'
      ? localSimulate(p)
      : validateSimulation(await request(c, '/api/simulate', s, p));
  },
  async optimize(p: Parameters, c: TransportConfig, s: AbortSignal): Promise<Optimization> {
    abortCheck(s);
    return c.mode === 'mock'
      ? localOptimize(p)
      : validateOptimization(await request(c, '/api/optimize', s, p), p);
  },
};
