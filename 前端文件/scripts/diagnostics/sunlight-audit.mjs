import * as T from 'three';
import {LOUVER} from '../../src/shading.ts';
const legacy=process.argv.includes('--legacy');const blade=legacy?{count:7,chord_m:.19,thickness_m:.035,offset_m:.2}:LOUVER;
const p={latitude:31.2,overhang_depth_m:.4,louver_angle_deg:0,window_wall_ratio:.45};
const height=16.2*p.window_wall_ratio/4.4,sill=(3-height)/2,top=(3+height)/2;
const items=[];function box(name,w,h,d,x,y,z,angle=0){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.x=angle;mesh.name=name;mesh.updateMatrixWorld(true);items.push(mesh)}
box('roof',5.56,.12,6.16,0,3.06,0);box('north-cut-wall',5.56,3,.12,0,1.5,3.06);box('east-cut-wall',.12,3,6.16,2.76,1.5,0);box('west-wall',.16,3,6,-2.78,1.5,0);
box('south-left',.5,3,.16,-2.45,1.5,-3.08);box('south-right',.5,3,.16,2.45,1.5,-3.08);box('south-upper',4.4,3-top,.16,0,(3+top)/2,-3.08);box('south-lower',4.4,sill,.16,0,sill/2,-3.08);
box('frame-top',4.5,.055,.12,0,top,-3);box('frame-bottom',4.5,.055,.14,0,sill,-3);for(const x of [-2.2,2.2])box('frame-side',.055,height,.1,x,1.5,-3);for(const x of [-.74,.74])box('mullion',.035,height,.07,x,1.5,-3);
box('overhang',4.9,.12,p.overhang_depth_m,0,top+.12,-3.1-p.overhang_depth_m/2);
for(let i=0;i<blade.count;i++)box('louver-'+i,4.4,blade.thickness_m,blade.chord_m,0,sill+(i+.5)*height/blade.count,-3-blade.offset_m,p.louver_angle_deg*Math.PI/180);
for(const season of ['summer','winter']){const alt=(season==='summer'?82.24:35.36)*Math.PI/180,dir=new T.Vector3(0,Math.sin(alt),-Math.cos(alt));const histogram={},exposed=[];
for(let iz=0;iz<120;iz++)for(let ix=0;ix<108;ix++){const point=new T.Vector3(-2.7+(ix+.5)*.05,.05,-3+(iz+.5)*.05),ray=new T.Raycaster(point,dir,0,30),hits=ray.intersectObjects(items,false);const name=hits[0]?.object.name??'OPEN';histogram[name]=(histogram[name]??0)+1;if(!hits.length)exposed.push([point.x,point.z])}
console.log(season,{altitude:alt*180/Math.PI,direction:dir.toArray(),exposedFloorPct:exposed.length/12960*100,zRange:exposed.length?[Math.min(...exposed.map(p=>p[1])),Math.max(...exposed.map(p=>p[1]))]:null,occluders:histogram});
const light=new T.DirectionalLight();light.position.copy(dir.clone().multiplyScalar(15));light.target.position.set(0,0,0);light.shadow.camera.left=-7;light.shadow.camera.right=7;light.shadow.camera.top=7;light.shadow.camera.bottom=-7;light.shadow.camera.near=.1;light.shadow.camera.far=50;light.shadow.camera.updateProjectionMatrix();light.updateMatrixWorld();light.target.updateMatrixWorld();light.shadow.updateMatrices(light);const mapPoint=new T.Vector3(0,.05,-.5).applyMatrix4(light.shadow.matrix);console.log('shadow UV/depth of floor near window',mapPoint.toArray());const uv=[];for(const x of [-2.85,2.85])for(const y of [-.2,3.2])for(const z of [-3.2,3.2])uv.push(new T.Vector3(x,y,z).applyMatrix4(light.shadow.matrix));console.log('room-corner shadow-volume bounds',{min:[0,1,2].map(i=>Math.min(...uv.map(p=>p.getComponent(i)))),max:[0,1,2].map(i=>Math.max(...uv.map(p=>p.getComponent(i))))});
}
