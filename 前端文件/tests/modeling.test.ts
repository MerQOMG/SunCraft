import {finishes} from '../src/surfaceSamples';
import {materialTextures} from '../src/materials';
import {metricUV,mapPart,finished} from '../src/modeling/surfaceUV';
import {EXAMPLE_ROOM,shadeGeometry} from '../src/geometry';
import {DEFAULTS} from '../src/model';
import {describe,it,expect,beforeAll} from 'vitest';
import * as T from 'three';
import {fineInterior,detailedSofa,detailedRug,detailedTable,detailedPlant} from '../src/modeling/interior';
import {fineWindow} from '../src/modeling/window';
import {meshInventory,softBlock} from '../src/modeling/construction';
import {windowGeometry} from '../src/model';
import {SEAT,seatTopAt,throwPoint,throwGeometry} from '../src/modeling/upholstery';
import {FINISH,VISUAL_CONSTRUCTION} from '../src/shading';
const palette={fabric:new T.MeshPhysicalMaterial(),walnut:new T.MeshStandardMaterial(),dark:new T.MeshStandardMaterial(),metal:new T.MeshStandardMaterial()};
const bounds=(o:T.Object3D)=>{o.updateMatrixWorld(true);return new T.Box3().setFromObject(o)};
let interior:T.Group;
beforeAll(()=>{interior=fineInterior(palette)});
describe('fine-model construction (pure geometry, not visual approval)',()=>{
 it('constructs finite positions/normals and instance transforms',()=>{interior.traverse(o=>{if(o instanceof T.Mesh){for(const key of ['position','normal'])expect(Array.from(o.geometry.attributes[key].array).every(Number.isFinite)).toBe(true);if(o instanceof T.InstancedMesh)expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBe(true)}})});
 it('batches structures and instances repeated details inside an explicit geometry budget',()=>{const s=meshInventory(interior);expect(s.meshes).toBeLessThan(40);expect(s.triangles).toBeLessThan(220000);expect(s.geometryBytes).toBeLessThan(16*1024*1024);expect(interior.getObjectByName('rug/576-instanced-twisted-fringe-strands')).toBeInstanceOf(T.InstancedMesh);expect(interior.getObjectByName('sofa/instanced-sewing-7mm-stitches')).toBeInstanceOf(T.InstancedMesh)});
 it('deforms cushion faces instead of only subdividing flat blocks',()=>{const g=softBlock(.91,.195,.835,'seat',0),p=g.attributes.position;const top=[];for(let i=0;i<p.count;i++)if(p.getY(i)>.09&&Math.abs(p.getX(i))<.3&&Math.abs(p.getZ(i))<.28)top.push(p.getY(i));expect(top.length).toBeGreaterThan(10);expect(Math.max(...top)-Math.min(...top)).toBeGreaterThan(.002)});
 it('keeps sofa floor contact and room-width bounds plausible',()=>{const b=bounds(detailedSofa(palette));expect(b.min.y).toBeGreaterThanOrEqual(FINISH.floorTop_m-.0001);expect(b.min.y).toBeLessThan(FINISH.rugTop_m+.001);expect(b.min.x).toBeGreaterThan(-2.7);expect(b.max.x).toBeLessThan(-.8);expect(b.max.y).toBeLessThan(1.4)});
 it('keeps rug and table anchored at the actual finish surfaces',()=>{const rug=bounds(detailedRug(palette)),table=bounds(detailedTable(palette));expect(rug.min.y).toBeCloseTo(FINISH.floorTop_m,5);expect(table.min.y).toBeCloseTo(FINISH.rugTop_m,5);expect(rug.max.y).toBeLessThan(.075);expect(table.max.y).toBeLessThan(.7)});
 it('connects planter to the floor and leaves within the room envelope',()=>{const b=bounds(detailedPlant(1.8,-2.32,1.05,FINISH.floorTop_m));expect(b.min.y).toBeCloseTo(FINISH.floorTop_m,5);expect(b.max.y).toBeLessThan(2.2);expect(b.max.x).toBeLessThan(2.7);expect(b.min.z).toBeGreaterThan(-3.02)});
 it('updates hollow profiles and instanced mountings at all window/tilt limits without changing solar aperture inputs',()=>{const w=fineWindow(EXAMPLE_ROOM);for(const ratio of [.25,.45,.65])for(const angle of [0,80]){const win=windowGeometry(ratio);const g=shadeGeometry({...DEFAULTS,window_wall_ratio:ratio,louver_angle_deg:angle},EXAMPLE_ROOM);w.update(g);const b=bounds(w.group);expect(Number.isFinite(b.min.y+b.max.y)).toBe(true);const top=w.group.children[0] as T.Mesh;expect(top.position.y).toBe(win.top+FINISH.floorTop_m);const size=new T.Vector3();top.geometry.computeBoundingBox();top.geometry.boundingBox!.getSize(size);expect(size.x).toBeCloseTo(EXAMPLE_ROOM.window_width_m+.1,5);expect(size.y).toBeCloseTo(.055,5);expect(size.z).toBeCloseTo(.1,5);const profile=new T.Mesh(top.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));profile.updateMatrixWorld(true);expect(new T.Raycaster(new T.Vector3(-3,0,.025),new T.Vector3(1,0,0)).intersectObject(profile).length).toBe(0);expect(new T.Raycaster(new T.Vector3(-3,.025,.025),new T.Vector3(1,0,0)).intersectObject(profile).length).toBeGreaterThan(0);expect((w.group.getObjectByName('variable-blade-pivot-pins') as T.InstancedMesh).count).toBe(g.blades.length*2);expect((w.group.getObjectByName('variable-blade-end-caps') as T.InstancedMesh).count).toBe(g.blades.length*2)}expect(EXAMPLE_ROOM.slat_chord_m).toBe(.06);expect(VISUAL_CONSTRUCTION.bladeThickness_m).toBe(.012)});
});

describe('procedural surface coordinates and maps',()=>{
 it('reuses deterministic color and packed linear relief across tinted fabrics',()=>{
  const library=materialTextures(2),seat=new T.MeshStandardMaterial(),pillow=new T.MeshStandardMaterial();
  library.apply(seat,'linen');library.apply(pillow,'linen');
  const map=seat.map!,relief=seat.bumpMap!;
  expect(pillow.map).toBe(map);expect(seat.roughnessMap).toBe(relief);
  expect(map.colorSpace).toBe(T.SRGBColorSpace);expect(relief.colorSpace).toBe(T.NoColorSpace);
  expect(map.anisotropy).toBe(2);expect(map.generateMipmaps).toBe(true);
  const floor=library.floor(5.4,6);expect(floor.bumpMap!.channel).toBe(1);
  expect(floor.map!.image.width).toBe(1024);expect(floor.bumpMap!.image.width).toBe(256);
  const disposed=new Set<T.Texture>();
  for(const t of [map,relief,floor.map!,floor.roughnessMap!,floor.bumpMap!])t.addEventListener('dispose',()=>{disposed.add(t)});
  library.dispose();expect(disposed.size).toBe(5);seat.dispose();pillow.dispose();floor.dispose();
 });
 it('tiles dyed fabrics and plaster without a boundary jump in any channel',()=>{
  for(const kind of ['plaster','linen','cushion','throw','rug','curtain'] as const){
   const sample=finishes[kind].sample;
   for(const [u,v] of [[.19,.17],[.87,.92],[-.27,.61]]){
    const reference=sample(u,v);
    for(const shifted of [sample(u+1,v),sample(u,v+1)])shifted.forEach((n,i)=>expect(n).toBeCloseTo(reference[i],8));
   }
  }
 });
 it('uses the same metric coordinate on adjacent wall pieces after a window resize',()=>{
  const bottom=new T.BoxGeometry(2,1,.1),top=new T.BoxGeometry(2,1,.1);
  const pos=bottom.attributes.position.array.slice();
  metricUV(bottom,new T.Vector3(0,.32,0),new T.Vector3(1,.64,1));
  metricUV(top,new T.Vector3(0,1.04,0),new T.Vector3(1,.8,1));
  const seam=(g:T.BufferGeometry,edge:number)=>{
   const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
   for(let i=0;i<p.count;i++)if(n.getZ(i)>.9&&p.getY(i)===edge)return uv.getY(i);
  };
  expect(seam(bottom,.5)).toBeCloseTo(.64);expect(seam(top,-.5)).toBeCloseTo(.64);
  expect(bottom.attributes.position.array).toEqual(pos);
  bottom.dispose();top.dispose();
 });
 it('maps a board lengthwise and its cut ends into separate texture regions',()=>{
  const g=new T.BoxGeometry(.46,.32,3.3),m=finished('walnut',0xffffff,'test wood','wood');
  mapPart(g,m);
  for(let i=0;i<g.attributes.uv.count;i++){
   const v=g.attributes.uv.getY(i);
   if(Math.abs(g.attributes.normal.getZ(i))>.99)expect(v).toBeGreaterThan(.75);
   else expect(v).toBeLessThan(.75);
  }
  g.dispose();m.dispose();
 });
});

describe('P1 meaningful form and contact regressions',()=>{
 it('uses a domestic seat height and a thinner tailored cushion, not a 700mm-high inflated seat',()=>{expect(SEAT.height).toBeLessThan(.15);const height=seatTopAt(SEAT.x,SEAT.z)-FINISH.floorTop_m;expect(height).toBeGreaterThan(.42);expect(height).toBeLessThan(.46)});
 it('keeps cloth resting on the real deformed seat surface without a floating ramp',()=>{const cushion=new T.Mesh(softBlock(SEAT.width,SEAT.height,SEAT.depth,'seat',2,SEAT),new T.MeshBasicMaterial({side:T.DoubleSide}));cushion.position.set(SEAT.x,SEAT.y,SEAT.z);cushion.updateMatrixWorld();for(let j=0;j<=10;j++)for(let i=0;i<=20;i++){const q=throwPoint(j/10-.5,i/20*.57),ray=new T.Raycaster(q.clone().add(new T.Vector3(0,1,0)),new T.Vector3(0,-1,0)),hit=ray.intersectObject(cushion)[0];expect(hit).toBeDefined();const gap=q.y-hit.point.y;expect(gap).toBeGreaterThan(0);expect(gap).toBeLessThan(.015)}});
 it('joins contact, curved turnover and free hang continuously with finite normals',()=>{for(const t of [.57,.74])for(const u of [-.5,-.2,0,.2,.5])expect(throwPoint(u,t-1e-7).distanceTo(throwPoint(u,t+1e-7))).toBeLessThan(.00001);const g=throwGeometry();for(const key of ['position','normal'])expect(Array.from(g.attributes[key].array).every(Number.isFinite)).toBe(true)});
 it('has a predominantly vertical free hang and substantial width-wise folds rather than one slanted board',()=>{for(const u of [-.4,0,.4]){const start=throwPoint(u,.76),end=throwPoint(u,1);expect(start.y-end.y).toBeGreaterThan(.19);expect(Math.abs(start.x-end.x)).toBeLessThan(.045)}const xs=Array.from({length:31},(_,i)=>throwPoint(i/30-.5,.92).x);expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(.015)});
 it('grounds four splayed table legs on the rug and keeps the lowered table/objects in proportion',()=>{const table=detailedTable(palette),b=bounds(table),feet=new Set<string>();expect(b.min.y).toBeCloseTo(FINISH.rugTop_m,5);expect(b.max.y).toBeLessThan(.60);table.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-FINISH.rugTop_m)<.00001)feet.add(`${Math.sign(p.getX(i)+.05)},${Math.sign(p.getZ(i)+.1)}`)}});expect(feet.size).toBe(4)});
});
