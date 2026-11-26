import {Vector3} from 'three';
import type {RoomGeometry} from './geometry';
import {RENDER_FLOOR_Y,windowGeometry} from './geometry';
export type CameraView='analysis';
export interface CameraViewport {width:number;height:number;topInsetPx:number;bottomInsetPx:number}
export const OVERVIEW_DIRECTION=new Vector3(.82,.64,1.28).normalize();
/** Render-only framing envelope. Does not move/resize any physical geometry.
 * Includes visible shell/base allowances and the complete 0..1.8m canopy envelope
 * at both supported WWR limits, so slider/playback need not refit the camera.
 */
export function framingPoints(room:RoomGeometry){
 const points:Vector3[]=[],f=RENDER_FLOOR_Y;
 for(const x of [-room.width_m/2-.17,room.width_m/2+.13])for(const y of [-.28,room.height_m+f+.02])for(const z of [-room.depth_m/2-.17,room.depth_m/2+.13])points.push(new Vector3(x,y,z));
 for(const ratio of [.25,.65])for(const depth of [0,1.8])for(const x of [-room.width_m/2,room.width_m/2])for(const extra of [0,.12])points.push(new Vector3(x,f+windowGeometry(ratio,room).top+extra,-room.depth_m/2-depth));
 return points;
}
/** Same accepted overview direction; tighter long-lens perspective, not an interior view. */
export function cameraPose(_view:CameraView,aspect:number,room:RoomGeometry,viewport?:CameraViewport){
 const ratio=Number.isFinite(aspect)&&aspect>0?Math.max(aspect,.1):1,fov=28,tanV=Math.tan(fov*Math.PI/360),tanH=tanV*ratio;
 const h=Math.max(viewport?.height??600,1),w=Math.max(viewport?.width??h*ratio,1),side=Math.min(14,w*.05),top=Math.min(viewport?.topInsetPx??10,h*.25),bottom=Math.min(viewport?.bottomInsetPx??12,h*.15);
 const limits={left:-1+2*side/w,right:1-2*side/w,bottom:-1+2*bottom/h,top:1-2*top/h};
 const right=new Vector3().crossVectors(new Vector3(0,1,0),OVERVIEW_DIRECTION).normalize(),up=new Vector3().crossVectors(OVERVIEW_DIRECTION,right),target=new Vector3(0,room.height_m*.43,-.1),points=framingPoints(room);
 let distance=0;
 const solve=()=>{distance=3.8;for(const p of points){const q=p.clone().sub(target),x=q.dot(right),y=q.dot(up),z=q.dot(OVERVIEW_DIRECTION);distance=Math.max(distance,z+.5,z+x/(tanH*(x>=0?limits.right:limits.left)),z+y/(tanV*(y>=0?limits.top:limits.bottom)))}};
 const project=()=>{let left=Infinity,rightX=-Infinity,bottomY=Infinity,topY=-Infinity;for(const p of points){const q=p.clone().sub(target),depth=distance-q.dot(OVERVIEW_DIRECTION),x=q.dot(right)/(depth*tanH),y=q.dot(up)/(depth*tanV);left=Math.min(left,x);rightX=Math.max(rightX,x);bottomY=Math.min(bottomY,y);topY=Math.max(topY,y)}return {left,right:rightX,bottom:bottomY,top:topY}};
 // Centre the projected envelope in the non-overlay safe region, rather than a sphere.
 for(let i=0;i<14;i++){solve();const b=project(),dx=(b.left+b.right-limits.left-limits.right)/2,dy=(b.bottom+b.top-limits.bottom-limits.top)/2;target.addScaledVector(right,dx*distance*tanH).addScaledVector(up,dy*distance*tanV)}
 solve();distance*=1.004;
 return {fov,target,position:OVERVIEW_DIRECTION.clone().multiplyScalar(distance).add(target),maxDistance:Math.max(25,distance*1.6),safeBounds:limits,projectedBounds:project()};
}
