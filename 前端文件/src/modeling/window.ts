import * as T from 'three';
import {Assembly,rectangle,namedMaterial} from './construction.ts';
import {LOUVER} from '../shading.ts';
/** A two-chamber aluminium extrusion; length may change, cross-section never scales. */
function profile(length:number,width:number,depth:number,axis:'x'|'y'){
 const s=rectangle(width,depth,.002);
 for(const sign of [-1,1]){const hole=new T.Path();const x=-width/2+.006,y=sign*depth*.25-depth*.18;hole.moveTo(x,y);hole.lineTo(x,y+depth*.36);hole.lineTo(-x,y+depth*.36);hole.lineTo(-x,y);hole.closePath();s.holes.push(hole)}
 const g=new T.ExtrudeGeometry(s,{depth:length,bevelEnabled:false,curveSegments:4,steps:1});g.translate(0,0,-length/2);
 if(axis==='y')g.rotateX(-Math.PI/2);else{g.rotateY(Math.PI/2);g.rotateX(Math.PI/2)}
 return g;
}
export function fineWindow(){
 const group=new T.Group();group.name='window-profile-and-hardware';
 const metal=namedMaterial('#545d58','powdercoated-aluminium',.4,{metalness:.7}),gasket=namedMaterial('#2d3834','EPDM-seals',.9),screw=namedMaterial('#9a9e93','stainless-fasteners',.3,{metalness:.85}),sillMat=namedMaterial('#d2cfc5','honed-stone-sill',.75);
 const horizontal=[new T.Mesh(profile(4.5,.055,.10,'x'),metal),new T.Mesh(profile(4.5,.055,.10,'x'),metal)];
 horizontal.forEach(m=>{m.castShadow=false;m.receiveShadow=true;group.add(m)});
 const vertical=[-2.2,2.2,-.74,.74].map((x,i)=>{const m=new T.Mesh(profile(1,i<2?.055:.035,i<2?.10:.07,'y'),metal);m.position.set(x,1.5,-3);m.castShadow=false;m.receiveShadow=true;group.add(m);return m});
 const innerH=[new T.Mesh(new T.BoxGeometry(4.37,.006,.012),gasket),new T.Mesh(new T.BoxGeometry(4.37,.006,.012),gasket)];innerH.forEach(m=>{m.castShadow=false;group.add(m)});
 const innerV=[-2.17,2.17,-.72,.72].map(x=>{const m=new T.Mesh(new T.BoxGeometry(.004,1,.014),gasket);m.position.set(x,1.5,-2.949);group.add(m);return m});
 const a=new Assembly();for(const side of [-1,1]){
  a.box(.036,2.9,.055,side*2.245,1.5,-3.19,metal,.005);
  // Anchored side track: wall shoe, return flange and screw heads are joined, not floating.
  for(const yy of [.28,1.5,2.72]){a.box(.06,.065,.11,side*2.255,yy,-3.12,metal,.003);a.add(new T.CylinderGeometry(.006,.006,.004,12),screw,new T.Vector3(side*2.252,yy,-3.062),new T.Euler(Math.PI/2,0,0))}
 }
 const fixed=a.finish('shade-mounts');fixed.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false});group.add(fixed);
 const pins=new T.InstancedMesh(new T.CylinderGeometry(.009,.009,.045,12),screw,LOUVER.count*2);pins.name='14-blade-pivot-pins';pins.castShadow=false;pins.receiveShadow=true;group.add(pins);
 const endCaps=new T.InstancedMesh(new T.BoxGeometry(.009,LOUVER.thickness_m*.93,LOUVER.chord_m*.94),metal,LOUVER.count*2);endCaps.name='14-blade-end-caps';endCaps.castShadow=false;endCaps.receiveShadow=true;group.add(endCaps);
 const sill=new T.Mesh(new T.BoxGeometry(4.57,.014,.36),sillMat);sill.castShadow=false;sill.receiveShadow=true;group.add(sill);
 const drip=new T.Mesh(new T.BoxGeometry(4.4,.004,.004),gasket);drip.castShadow=false;group.add(drip);
 const update=(win:{sill:number;top:number;height:number},angle:number)=>{
  horizontal[0].position.set(0,win.top,-3);horizontal[1].position.set(0,win.sill,-3);
  vertical.forEach(m=>m.scale.y=win.height);
  innerH[0].position.set(0,win.top-.029,-2.946);innerH[1].position.set(0,win.sill+.029,-2.946);innerV.forEach(m=>m.scale.y=Math.max(.1,win.height-.06));
  sill.position.set(0,win.sill-.004,-2.95);drip.position.set(0,win.sill-.059,-2.81);
  for(let i=0;i<LOUVER.count;i++)for(let side=0;side<2;side++){
   const at=i*2+side,yy=win.sill+(i+.5)*win.height/LOUVER.count,xx=side===0?-2.2:2.2;
   pins.setMatrixAt(at,new T.Matrix4().compose(new T.Vector3(xx,yy,-3-LOUVER.offset_m),new T.Quaternion().setFromEuler(new T.Euler(0,0,Math.PI/2)),new T.Vector3(1,1,1)));
   endCaps.setMatrixAt(at,new T.Matrix4().compose(new T.Vector3(xx*.997,yy,-3-LOUVER.offset_m),new T.Quaternion().setFromEuler(new T.Euler(angle*Math.PI/180,0,0)),new T.Vector3(1,1,1)));
  }
  pins.instanceMatrix.needsUpdate=endCaps.instanceMatrix.needsUpdate=true;pins.computeBoundingSphere();endCaps.computeBoundingSphere();
 };
 return {group,update};
}
