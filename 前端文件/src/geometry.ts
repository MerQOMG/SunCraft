/** Existing engine ideal aperture contract. No metric/scoring calculations here. */
import type {Parameters} from './model';
export interface RoomGeometry {width_m:number;depth_m:number;height_m:number;window_width_m:number;sill_m:number;slat_chord_m:number;slat_pitch_m:number;sofa_depth_range_m:[number,number];sofa_width_m:number;grid_shape:[number,number];geometry_model:'head-periodic-outward-down-v1'}
export const RENDER_FLOOR_Y=.041;
// Explicit offline geometry snapshot, never a fallback for a live API missing metadata.
export const EXAMPLE_ROOM:RoomGeometry={width_m:5.4,depth_m:6,height_m:3,window_width_m:4.86,sill_m:.45,slat_chord_m:.06,slat_pitch_m:.45,sofa_depth_range_m:[2,3.8],sofa_width_m:2.2,grid_shape:[24,24],geometry_model:'head-periodic-outward-down-v1'};
export function windowGeometry(ratio:number,room:RoomGeometry){const height=room.width_m*room.height_m*ratio/room.window_width_m;return {width:room.window_width_m,height,sill:room.sill_m,top:room.sill_m+height,center:room.sill_m+height/2}}
export function shadeGeometry(p:Parameters,room:RoomGeometry){const window=windowGeometry(p.window_wall_ratio,room),angle=p.louver_angle_deg*Math.PI/180;
 const count=Math.ceil(Math.max(0,window.height/room.slat_pitch_m-1e-10));
 const blades=Array.from({length:count},(_,i)=>{const rootHeight=window.top-i*room.slat_pitch_m;return {rootHeight,outerHeight:rootHeight-room.slat_chord_m*Math.sin(angle),outerDepth:-room.slat_chord_m*Math.cos(angle),centerHeight:rootHeight-room.slat_chord_m*Math.sin(angle)/2,centerDepth:-room.slat_chord_m*Math.cos(angle)/2}});
 return {window,angle,blades,canopy:{depth:p.overhang_depth_m,height:window.top,visible:p.overhang_depth_m>0}};
}
export function validRoom(value:unknown):value is RoomGeometry {if(!value||typeof value!=='object')return false;const r=value as RoomGeometry;
 if(r.geometry_model!=='head-periodic-outward-down-v1')return false;
 for(const k of ['width_m','depth_m','height_m','window_width_m','slat_chord_m','slat_pitch_m','sofa_width_m'] as const)if(!Number.isFinite(r[k])||r[k]<=0)return false;
 return Number.isFinite(r.sill_m)&&r.sill_m>=0&&r.sill_m<r.height_m&&r.window_width_m<=r.width_m&&Array.isArray(r.sofa_depth_range_m)&&r.sofa_depth_range_m.length===2&&r.sofa_depth_range_m.every(Number.isFinite)&&r.sofa_depth_range_m[0]>=0&&r.sofa_depth_range_m[1]>r.sofa_depth_range_m[0]&&r.sofa_depth_range_m[1]<=r.depth_m&&Array.isArray(r.grid_shape)&&r.grid_shape.length===2&&r.grid_shape.every(n=>Number.isInteger(n)&&n>=2&&n<=256);
}
