import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
/** Static parts are batched per material; a tube/stitch is never an individual draw call. */
export class Assembly {
 group=new T.Group();batches=new Map<T.Material,T.BufferGeometry[]>();
 add(g:T.BufferGeometry,m:T.Material,position=new T.Vector3(),rotation=new T.Euler(),scale=new T.Vector3(1,1,1)){
  const transform=new T.Matrix4().compose(position,new T.Quaternion().setFromEuler(rotation),scale);g.applyMatrix4(transform);
  const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
  const list=this.batches.get(m)??[];list.push(flat);this.batches.set(m,list);return this;
 }
 box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material,r=.006,rotation=new T.Euler()){
  return this.add(new RoundedBoxGeometry(w,h,d,3,Math.min(r,h*.45,w*.45,d*.45)),m,new T.Vector3(x,y,z),rotation);
 }
 tube(points:T.Vector3[],radius:number,m:T.Material,segments=24,closed=false){const curve=new T.CatmullRomCurve3(points,closed,'centripetal');return this.add(new T.TubeGeometry(curve,segments,radius,5,closed),m)}
 finish(name:string){
  this.group.name=name;
  for(const [material,parts] of this.batches){const geometry=mergeGeometries(parts,false);if(!geometry)throw Error(`Cannot merge ${name}`);parts.forEach(p=>p.dispose());const mesh=new T.Mesh(geometry,material);mesh.name=`${name}/${material.name||material.type}`;mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh)}
  this.batches.clear();return this.group;
 }
}
export function rectangle(w:number,d:number,r:number){const s=new T.Shape(),x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
export function slab(w:number,d:number,t:number,r:number,bevel=.002){const g=new T.ExtrudeGeometry(rectangle(w,d,r),{depth:t,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:8});g.translate(0,0,-t/2);g.rotateX(-Math.PI/2);return g}
export function seamLoop(w:number,d:number,r:number,y:number,center:T.Vector3){return rectangle(w,d,r).getSpacedPoints(110).map(p=>new T.Vector3(p.x+center.x,y,p.y+center.z))}
/** Crown, compressive hollow and quiet corner tension alter silhouette/normals, not a noisy texture. */
export interface UpholsteryProfile {radius?:number;crown?:number;hollow?:number;bulge?:number;crease?:number}
export function seatOffset(nx:number,nz:number,profile:UpholsteryProfile={}){return Math.max(0,1-nx*nx)*Math.max(0,1-nz*nz)*(profile.crown??.019)-(profile.hollow??.019)*Math.exp(-((nx-.13)**2/.22+(nz+.1)**2/.3))}
export function softBlock(w:number,h:number,d:number,kind:'seat'|'back'|'pillow'|'arm',seed=0,profile:UpholsteryProfile={}){
 const radius=Math.min(Math.min(w,h,d)*.49,profile.radius??(kind==='pillow'?Math.min(w,h,d)*.43:Math.min(h*.43,w*.43,d*.43,.11)));
 // RoundedBox's large flat face has no interior samples: use a face lattice so
 // compression really changes the surface, then project its boundary to a fillet.
 const g=new T.BoxGeometry(w,h,d,22,12,22),p=g.attributes.position;
 const inner=new T.Vector3(w/2-radius,h/2-radius,d/2-radius),point=new T.Vector3(),core=new T.Vector3();
 for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);core.copy(point).clamp(inner.clone().negate(),inner);point.sub(core).normalize().multiplyScalar(radius).add(core);p.setXYZ(i,point.x,point.y,point.z)}
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const nx=x/(w*.5),ny=y/(h*.5),nz=z/(d*.5);
  if(kind==='seat'){
   y+=seatOffset(nx,nz,profile)*T.MathUtils.smoothstep(ny,.25,1);
   y+=.0015*Math.sin(14*nz+seed)*Math.sin(11*nx)*Math.max(0,1-Math.abs(ny-.7)*2);
  }else if(kind==='back'||kind==='pillow'){
   const face=Math.max(0,1-ny*ny)*Math.max(0,1-nz*nz);
   x+=(profile.bulge??.024)*face*Math.sign(nx)*(kind==='pillow'?1.35:1);
   const crease=Math.exp(-((Math.abs(ny)-.72)**2/.02+(Math.abs(nz)-.69)**2/.035));x-=(profile.crease??.009)*crease*Math.sign(nx);
   x+=Math.sin(ny*19+nz*5+seed)*.0015*(1-Math.abs(nz))**2;
  }else{y+=(profile.crown??.006)*(1-nx*nx)*(1-nz*nz)}
  p.setXYZ(i,x,y,z);
 }
 // Weld for smooth construction normals only; retain original UV islands.
 const positionsOnly=g.clone();positionsOnly.deleteAttribute('normal');positionsOnly.deleteAttribute('uv');const welded=mergeVertices(positionsOnly,1e-6);welded.computeVertexNormals();const np=welded.attributes.position,nn=welded.attributes.normal,lookup=new Map<string,T.Vector3>();
 const key=(x:number,y:number,z:number)=>`${Math.round(x*1e5)},${Math.round(y*1e5)},${Math.round(z*1e5)}`;
 for(let i=0;i<np.count;i++)lookup.set(key(np.getX(i),np.getY(i),np.getZ(i)),new T.Vector3().fromBufferAttribute(nn,i));const normals=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++)lookup.get(key(p.getX(i),p.getY(i),p.getZ(i)))!.toArray(normals,i*3);g.setAttribute('normal',new T.BufferAttribute(normals,3));positionsOnly.dispose();welded.dispose();return g;
}
export function lathe(points:[number,number][],segments=48){return new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),segments)}
export function cylinderBetween(a:T.Vector3,b:T.Vector3,ra:number,rb:number,segments=8){const g=new T.CylinderGeometry(rb,ra,a.distanceTo(b),segments,1,false);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g}
export function namedMaterial(color:T.ColorRepresentation,name:string,roughness=.85,extra:T.MeshStandardMaterialParameters={}){const m=new T.MeshStandardMaterial({color,roughness,...extra});m.name=name;return m}
export function meshInventory(root:T.Object3D){
 let meshes=0,instances=0,triangles=0,geometryBytes=0;const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes++;const count=o instanceof T.InstancedMesh?o.count:1;instances+=count;triangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*count;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});
 for(const g of geometries){if(g.index)geometryBytes+=g.index.array.byteLength;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength}
 return {meshes,instances,triangles,uniqueGeometries:geometries.size,geometryBytes,materials:materials.size};
}
