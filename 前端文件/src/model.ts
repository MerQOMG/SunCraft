import { EXAMPLE_ROOM } from './geometry';
import type { RoomGeometry } from './geometry';
import type { ScoreReport } from './scoring/report';
export type Season = 'summer' | 'winter';
export interface Parameters {
  city_id: string;
  latitude: number;
  overhang_depth_m: number;
  louver_angle_deg: number;
  window_wall_ratio: number;
}
export interface City {
  id: string;
  name: string;
  latitude: number;
}
export interface Presets {
  cities: City[];
  daylight_threshold_pct: number;
  room?: RoomGeometry;
  geometry_error?: string;
}
export interface Ray {
  kind: 'blocked' | 'transmitted';
  start: [number, number];
  end: [number, number];
  window_entry?: [number, number] | null;
}
export interface Simulation {
  score_report?: ScoreReport;
  score_report_error?: string;
  solar_angles: { summer_noon_alt: number; winter_noon_alt: number };
  metrics: {
    summer_shading_rate: number;
    winter_solar_gain_rate: number;
    daylight_compliance_rate: number;
    is_gb_compliant: boolean;
    winter_penetration_m: number;
  };
  heatmap_grid: number[][];
  svg_rays: {
    summer_blocked: boolean;
    winter_hit_depth: number;
    summer?: Ray[];
    winter?: Ray[];
    summer_incident?: boolean;
    winter_incident?: boolean;
  };
}
export interface Optimization {
  parameters: Parameters;
  before: Simulation;
  after: Simulation;
}
export const DEFAULTS: Parameters = {
  city_id: 'shanghai',
  latitude: 31.2,
  overhang_depth_m: 0.4,
  louver_angle_deg: 0,
  window_wall_ratio: 0.45,
};
export const PRESETS: Presets = {
  cities: [
    { id: 'shanghai', name: '上海 / 同济', latitude: 31.2 },
    { id: 'beijing', name: '北京', latitude: 39.9 },
    { id: 'guangzhou', name: '广州', latitude: 23.1 },
    { id: 'harbin', name: '哈尔滨', latitude: 45.8 },
  ],
  daylight_threshold_pct: 2,
  room: EXAMPLE_ROOM,
};
export const LIMITS = {
  overhang_depth_m: { min: 0, max: 1.8, step: 0.05 },
  louver_angle_deg: { min: 0, max: 80, step: 1 },
  window_wall_ratio: { min: 0.25, max: 0.65, step: 0.01 },
};
export const percent = (n: number) => `${Math.round(n * 100)}%`;
