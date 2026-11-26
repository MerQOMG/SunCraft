import {EXAMPLE_ROOM,windowGeometry as contractWindowGeometry} from './geometry';
import type {RoomGeometry} from './geometry';
import type {ScoreReport} from './scoring/report';
export type Season = 'summer' | 'winter';
export interface Parameters { city_id: string; latitude: number; overhang_depth_m: number; louver_angle_deg: number; window_wall_ratio: number }
export interface City {id: string; name: string; latitude: number}
export interface Presets {cities: City[]; daylight_threshold_pct: number;room?:RoomGeometry;geometry_error?:string}
export interface Ray {kind:'blocked'|'transmitted';start:[number,number];end:[number,number];window_entry?:[number,number]|null}
export interface Simulation {score_report?:ScoreReport;score_report_error?:string;solar_angles: {summer_noon_alt: number; winter_noon_alt: number}; metrics: {summer_shading_rate: number; winter_solar_gain_rate: number; daylight_compliance_rate: number; is_gb_compliant: boolean; winter_penetration_m: number};heatmap_grid: number[][];svg_rays: {summer_blocked: boolean;winter_hit_depth: number;summer?:Ray[];winter?:Ray[];summer_incident?:boolean;winter_incident?:boolean}}
export interface Optimization {parameters: Parameters; before: Simulation; after: Simulation}
export const DEFAULTS: Parameters = {city_id:'shanghai',latitude:31.2,overhang_depth_m:.4,louver_angle_deg:0,window_wall_ratio:.45};
export const PRESETS: Presets = {cities:[{id:'shanghai',name:'上海 / 同济',latitude:31.2},{id:'beijing',name:'北京',latitude:39.9},{id:'guangzhou',name:'广州',latitude:23.1},{id:'harbin',name:'哈尔滨',latitude:45.8}],daylight_threshold_pct:2,room:EXAMPLE_ROOM};
export const LIMITS = {overhang_depth_m:{min:0,max:1.8,step:.05},louver_angle_deg:{min:0,max:80,step:1},window_wall_ratio:{min:.25,max:.65,step:.01}};
export const clamp = (n: number,min=0,max=1) => Math.min(max,Math.max(min,n));
export const percent = (n: number) => `${Math.round(n*100)}%`;
/** Mock-only convenience: explicit offline metadata snapshot, not a live API fallback. */
export function windowGeometry(ratio:number){return contractWindowGeometry(ratio,EXAMPLE_ROOM)}
// Illustrative response generator, NOT the FastAPI physics model or a compliance certificate.
export function mockSimulate(p: Parameters,threshold=2): Simulation {
 const shade=clamp(.12+p.overhang_depth_m*.43+Math.sin(p.louver_angle_deg*Math.PI/180)*.38);
 const winter=clamp(.97-p.overhang_depth_m*.14-p.louver_angle_deg*.004);
 const grid=Array.from({length:24},(_,z)=>Array.from({length:24},(_,x)=>Number((.25+8.8*p.window_wall_ratio*Math.exp(-z/19)*(1-.27*p.overhang_depth_m)*(1-p.louver_angle_deg/190)*(1-.13*Math.abs(x-11.5)/11.5)).toFixed(3))));
 const day=grid.flat().filter(v=>v>=threshold).length/576;
 const winterAlt=90-p.latitude-23.44;
 return {solar_angles:{summer_noon_alt:90-Math.abs(p.latitude-23.44),winter_noon_alt:winterAlt},metrics:{summer_shading_rate:shade,winter_solar_gain_rate:winter,daylight_compliance_rate:day,is_gb_compliant:day>=.8,winter_penetration_m:Math.min(6,windowGeometry(p.window_wall_ratio).top/Math.tan(winterAlt*Math.PI/180))*winter},heatmap_grid:grid,svg_rays:{summer_blocked:shade>.75,winter_hit_depth:Math.min(6,windowGeometry(p.window_wall_ratio).top/Math.tan(winterAlt*Math.PI/180))*winter}};
}
export function mockOptimize(p: Parameters): Optimization {
 let best={...p};let score=-Infinity;
 for(let d=0;d<=1.801;d+=.1) for(let a=0;a<=80;a+=5){const q={...p,overhang_depth_m:Number(d.toFixed(2)),louver_angle_deg:a};const m=mockSimulate(q).metrics; const s=.48*m.summer_shading_rate+.32*m.winter_solar_gain_rate+.2*m.daylight_compliance_rate-1.5*Math.max(0,.8-m.daylight_compliance_rate);if(s>score){score=s;best=q}}
 return {parameters:best,before:mockSimulate(p),after:mockSimulate(best)};
}
