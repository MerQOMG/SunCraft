import {Vector3} from 'three';
export type CameraView='analysis';
/** User-selected original overview, unchanged. No interior-camera mode exposed. */
export function cameraPose(_view:CameraView,aspect:number){
 const ratio=Math.max(Number.isFinite(aspect)?aspect:1,.4);
 const fov=35,v=Math.PI*fov/360,half=Math.min(v,Math.atan(Math.tan(v)*ratio));
 const distance=3.85/Math.sin(half),target=new Vector3(0,1.05,0);
 return {fov,target,position:new Vector3(.82,.64,1.28).normalize().multiplyScalar(distance).add(target),maxDistance:Math.max(25,distance*1.6)};
}
