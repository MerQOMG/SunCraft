import * as T from 'three';
import {seatOffset} from './construction.ts';
/** Local sofa coordinates; support is an ergonomic 43 cm above the finished floor. */
export const SEAT={width:.85,height:.136,depth:.86,x:-1.865,y:.410,z:1.35,radius:.028,crown:.011,hollow:.012} as const;
export function seatTopAt(x:number,z:number){
 const dx=x-SEAT.x,dz=z-SEAT.z,r=SEAT.radius;
 const top=SEAT.height/2-r+Math.sqrt(Math.max(0,r*r-Math.max(0,Math.abs(dx)-(SEAT.width/2-r))**2-Math.max(0,Math.abs(dz)-(SEAT.depth/2-r))**2));
 return SEAT.y+top+seatOffset(dx/(SEAT.width/2),dz/(SEAT.depth/2),SEAT);
}
/** Hand-modelled gravity drape, not a cloth solver. Surface contact → rounded turn → hanging folds. */
export function throwPoint(u:number,t:number){
 const z=1.32+u*.64+.018*Math.sin(t*Math.PI)*Math.sin(u*3*Math.PI);
 const ridgeA=Math.exp(-Math.pow((u+.23+.045*Math.sin(t*4))/.075,2)),ridgeB=Math.exp(-Math.pow((u-.14-.045*Math.sin(t*7))/.10,2));
 const wave=.90*ridgeA+.72*ridgeB+.18*(.5+.5*Math.sin(u*25+t*7));
 const fold=.0018+(.004+.028*T.MathUtils.smoothstep(t,.4,1))*wave;
 const x0=-1.468,r=.028,top=seatTopAt(x0,z);
 if(t<=.57){const x=-2.13+(x0+2.13)*t/.57;return new T.Vector3(x,seatTopAt(x,z)+fold,z)}
 if(t<=.74){const a=(t-.57)/.17*Math.PI/2;return new T.Vector3(x0+(r+fold)*Math.sin(a),top-r+(r+fold)*Math.cos(a),z)}
 const v=(t-.74)/.26,hem=.240+.036*u+.015*Math.sin(u*8)+.006*Math.cos(u*15);
 return new T.Vector3(x0+r+fold+.01*v+.016*Math.sin(Math.PI*v),top-r-v*hem+.005*Math.sin(u*14+v*4)*Math.sin(v*Math.PI),z);
}
export function throwGeometry(){const g=new T.PlaneGeometry(1,1,48,72),p=g.attributes.position;for(let i=0;i<p.count;i++){const q=throwPoint(p.getX(i),p.getY(i)+.5);p.setXYZ(i,q.x,q.y,q.z)}g.computeVertexNormals();return g}
