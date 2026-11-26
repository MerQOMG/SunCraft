import * as T from 'three';
import {Assembly,softBlock,seamLoop,slab,lathe,cylinderBetween,namedMaterial,applyPositionUvMetres} from './construction.ts';
import {coat,finished} from './surfaceUV';
import {SEAT,throwGeometry,throwPoint} from './upholstery.ts';
import {FINISH,sofaFoot} from '../shading.ts';
export interface Palette {fabric:T.MeshPhysicalMaterial;walnut:T.MeshStandardMaterial;dark:T.MeshStandardMaterial;metal:T.MeshStandardMaterial;fabricMap?:T.Texture;fabricBump?:T.Texture;rugMap?:T.Texture;rugBump?:T.Texture;rugRoughness?:T.Texture}
function fabricVariant(p:Palette,color:string,name:string,kind:'cushion'|'throw'='cushion'){
 const m=coat(p.fabric.clone(),kind,'original');m.color.set(color);m.name=name;
 m.sheen=kind==='throw'?.23:.16;return m;
}
function stitches(loops:T.Vector3[][],material:T.Material){
 const transforms:T.Matrix4[]=[];const up=new T.Vector3(0,1,0);
 for(const points of loops){const curve=new T.CatmullRomCurve3(points,true,'centripetal'),length=curve.getLength(),count=Math.floor(length/.016);for(let i=0;i<count;i++){const at=curve.getPointAt((i+.5)/count),tangent=curve.getTangentAt((i+.5)/count);transforms.push(new T.Matrix4().compose(at,new T.Quaternion().setFromUnitVectors(up,tangent),new T.Vector3(1,.007,1)))}}
 const mesh=new T.InstancedMesh(new T.CylinderGeometry(.00065,.00065,1,4,1,true),material,transforms.length);transforms.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.name='sofa/instanced-sewing-7mm-stitches';mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();return mesh;
}
export function detailedSofa(p:Palette){
 const a=new Assembly();const fabric=p.fabric;fabric.name='tailored-linen';const wood=p.walnut;wood.name='walnut-joinery';const piping=namedMaterial('#b9b2a4','welt-cord',1),thread=namedMaterial('#a9a294','sewing-thread',1),darkFeet=namedMaterial('#4e4b42','feet-pads');const loops:T.Vector3[][]=[];
 // A low tailored deck on a visible wood rail; seat top ~474mm, not the old 694mm.
 a.box(.94,.065,2.72,-1.91,.24,.48,wood,.009);a.box(.95,.006,2.75,-1.91,.2745,.48,darkFeet,.002);
 for(const x of [-2.23,-1.48])for(const z of [-.7,1.65]){const f=sofaFoot(x>-1.85);a.add(new T.CylinderGeometry(.024,.019,f.height,16),wood,new T.Vector3(x,f.center,z));a.add(new T.CylinderGeometry(.022,.022,.005,16),darkFeet,new T.Vector3(x,f.bottom+.0025,z))}
 a.add(softBlock(.94,.066,2.83,'arm',0,{radius:.014,crown:.0035}),fabric,new T.Vector3(-1.91,.309,.48));
 a.add(softBlock(.115,.54,2.84,'arm',0,{radius:.022,crown:.001}),fabric,new T.Vector3(-2.385,.56,.48));
 for(const z of [-.91,1.87])a.add(softBlock(1.03,.36,.14,'arm',0,{radius:.025,crown:.0015}),fabric,new T.Vector3(-1.91,.48,z));
 for(let i=0;i<3;i++){
  const z=-.43+i*.89;
  a.add(softBlock(SEAT.width,SEAT.height,SEAT.depth,'seat',i,SEAT),fabric,new T.Vector3(SEAT.x,SEAT.y,z));
  a.add(softBlock(.15,.46,.84,'back',i,{radius:.04,bulge:.009,crease:.0045}),fabric,new T.Vector3(-2.22,.67,z),new T.Euler(0,0,.10));
  const seat=seamLoop(.848,.858,.027,SEAT.y,new T.Vector3(SEAT.x,0,z));loops.push(seat);a.tube(seat,.0014,piping,110,true);
  const back=seamLoop(.459,.839,.039,0,new T.Vector3()).map(v=>new T.Vector3(0,v.x,v.z).applyEuler(new T.Euler(0,0,.10)).add(new T.Vector3(-2.22,.67,z)));loops.push(back);a.tube(back,.0013,piping,100,true);
 }
 const rust=fabricVariant(p,'#a47b61','clay-linen'),sage=fabricVariant(p,'#737c69','olive-linen');
 for(const [z,m,rz] of [[-.48,rust,.17],[1.1,sage,.21]] as const){const position=new T.Vector3(-2.075,.64,z);a.add(softBlock(.16,.36,.40,'pillow',z,{radius:.052,bulge:.012,crease:.004}),m,position,new T.Euler(.11,0,rz));
  const points=seamLoop(.359,.399,.051,0,new T.Vector3()).map(v=>new T.Vector3(0,v.x,v.z).applyEuler(new T.Euler(.11,0,rz)).add(position));a.tube(points,.0013,piping,96,true);loops.push(points);
 }
 const blanket=fabricVariant(p,'#6f796b','gravity-draped-wool-throw','throw');blanket.side=T.DoubleSide;
 const cloth=throwGeometry(), weaveUV=cloth.attributes.uv;
 for(let i=0;i<weaveUV.count;i++)weaveUV.setXY(i,weaveUV.getX(i)*.64,weaveUV.getY(i)*.98);
 a.add(cloth,blanket);
 for(const side of [-.5,.5]){const edge=Array.from({length:73},(_,i)=>throwPoint(side,i/72));a.tube(edge,.0012,blanket,90)}
 const hem=Array.from({length:49},(_,i)=>throwPoint(i/48-.5,1));a.tube(hem,.0015,blanket,70);
 const group=a.finish('detailed-sofa');group.add(stitches(loops,thread));group.position.z=-.8;return group;
}
export function detailedRug(p:Palette){
 const a=new Assembly(),wool=coat(namedMaterial('#ffffff','soft-wool-pile',1,{...(p.rugMap?{map:p.rugMap}:{}),...(p.rugBump?{bumpMap:p.rugBump}:{}),...(p.rugRoughness?{roughnessMap:p.rugRoughness}:{}),bumpScale:.001}),'rug','original'),binding=finished('linen','#c9bfad','rug-overlock-binding'),strand=namedMaterial('#c9beaa','cotton-fringe',1);
 a.box(3.6,FINISH.rugThickness_m,3.8,-.05,FINISH.floorTop_m+FINISH.rugThickness_m/2,.05,wool,.008);
 a.tube(seamLoop(3.584,3.784,.023,.064,new T.Vector3(-.05,0,.05)),.0018,binding,180,true);
 const group=a.finish('woven-rug');const pile=group.getObjectByName('woven-rug/soft-wool-pile');if(pile instanceof T.Mesh)applyPositionUvMetres(pile.geometry);
 const count=96,perSide=count*3,curve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.001,.0015,.028),new T.Vector3(-.002,0,.06)]),fringe=new T.InstancedMesh(new T.TubeGeometry(curve,8,.0011,4,false),strand,perSide*2),knots=new T.InstancedMesh(new T.CylinderGeometry(.0035,.003,.007,6),binding,count*2);
 let k=0;for(const sign of [-1,1])for(let i=0;i<count;i++){
  const x=-1.79+i*3.48/(count-1),z=.05+sign*1.896,yy=.05;
  knots.setMatrixAt(k++,new T.Matrix4().compose(new T.Vector3(x,yy,z),new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0)),new T.Vector3(1,1,1)));
  for(let strandIndex=0;strandIndex<3;strandIndex++){const index=(sign<0?0:perSide)+i*3+strandIndex;fringe.setMatrixAt(index,new T.Matrix4().compose(new T.Vector3(x+(strandIndex-1)*.0023,yy,z),new T.Quaternion().setFromEuler(new T.Euler(0,sign<0?Math.PI:0,0)),new T.Vector3(1,1,.87+.12*Math.sin(i*4.7+strandIndex))))}
 }
 fringe.name='rug/576-instanced-twisted-fringe-strands';knots.name='rug/192-instanced-binding-knots';fringe.receiveShadow=knots.receiveShadow=true;fringe.castShadow=knots.castShadow=false;fringe.computeBoundingSphere();knots.computeBoundingSphere();group.add(fringe,knots);return group;
}
export function detailedTable(p:Palette){
 const a=new Assembly(),wood=p.walnut,edge=namedMaterial('#584636','joinery-recess'),paper=finished('pages','#fffdf7','book-page-block'),cover=finished('bookCloth','#627a71','cloth-book-cover'),cover2=finished('bookCloth','#d2bf9d','linen-book-cover'),porcelain=finished('porcelain',0xffffff,'glazed-porcelain','wrap'),coffee=namedMaterial('#39261a','coffee-surface',.16),coaster=finished('stone','#c6b39a','ceramic-saucer');
 // A 28mm top, slim apron and level-cut splayed legs. Tabletop is 442.5mm above datum.
 a.add(slab(1.16,1.32,.028,.14,.0015),wood,new T.Vector3(-.05,.427,-.1));
 a.add(slab(1.12,1.28,.004,.12,.0007),edge,new T.Vector3(-.05,.4088,-.1));
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const foot=new T.Vector3(-.05+sx*.42,FINISH.rugTop_m,-.1+sz*.54),top=new T.Vector3(-.05+sx*.38,.4115,-.1+sz*.48),height=top.y-foot.y;
  const leg=new T.CylinderGeometry(.030,.020,height,16),v=leg.attributes.position;
  // Shear the taper, not the end planes: each foot is cut horizontal on the rug.
  for(let i=0;i<v.count;i++){const t=(v.getY(i)+height/2)/height;v.setXYZ(i,v.getX(i)+T.MathUtils.lerp(foot.x,top.x,t),foot.y+t*height,v.getZ(i)+T.MathUtils.lerp(foot.z,top.z,t))}leg.computeVertexNormals();a.add(leg,wood);
 }
 for(const sx of [-1,1])a.box(.033,.053,.99,-.05+sx*.38,.385,-.1,wood,.004);
 for(const sz of [-1,1])a.box(.79,.053,.033,-.05,.385,-.1+sz*.48,wood,.004);
 // Hardcover boards, page edges, separate rounded spine; not single colored cubes.
 for(let book=0;book<2;book++){
  const yy=.461+book*.034,xx=-.28+book*.018,zz=-.38+book*.014,m=book?cover:cover2;
  a.add(slab(.37,.49,.004,.009,.0007),m,new T.Vector3(xx,yy-.016,zz));a.add(slab(.37,.49,.004,.009,.0007),m,new T.Vector3(xx,yy+.016,zz));a.box(.352,.026,.468,xx+.003,yy,zz,paper,.002);
  a.box(.013,.033,.482,xx-.18,yy,zz,m,.005);
  for(let line=0;line<9;line++)a.box(.001,.00045,.444,xx+.179,yy-.011+line*.0026,zz,edge,.0001);
  a.box(.18,.0008,.002,xx+.015,yy+.019,zz-.05,edge,.0002);a.box(.12,.0008,.002,xx+.015,yy+.019,zz-.025,edge,.0002);
 }
 const cx=.30,cz=.12;
 a.add(lathe([[0,0],[.087,0],[.104,.003],[.106,.008],[.09,.011],[.064,.006],[0,.006]],48),coaster,new T.Vector3(cx,.443,cz));
 a.add(lathe([[0,0],[.047,0],[.055,.007],[.062,.105],[.063,.12],[.057,.124],[.055,.117],[.051,.019],[0,.017]],56),porcelain,new T.Vector3(cx,.453,cz));
 a.add(new T.TorusGeometry(.029,.008,8,28),porcelain,new T.Vector3(cx+.063,.517,cz));
 const liquid=new T.CircleGeometry(.054,48);liquid.rotateX(-Math.PI/2);a.add(liquid,coffee,new T.Vector3(cx,.547,cz));
 a.add(new T.TorusGeometry(.046,.0008,4,48),coffee,new T.Vector3(cx,.5475,cz),new T.Euler(Math.PI/2,0,0));
 return a.finish('walnut-coffee-table');
}
export function detailedPlant(x:number,z:number,scale:number,floorY:number){
 const a=new Assembly(),ceramic=finished('clay','#d9cbb7','stoneware-planter','wrap'),soil=finished('earth','#a6957e','potting-soil'),bark=finished('bark','#907f6a','woody-branches'),vein=new T.MeshPhysicalMaterial({name:'leaf-midrib',color:'#617756',roughness:.92,specularIntensity:.08}),green=[['#56734e','mature-leaves'],['#74875d','new-leaves'],['#44664f','deep-leaves']].map(([tint,name])=>coat(new T.MeshPhysicalMaterial({name,color:tint,roughness:1,side:T.DoubleSide,specularIntensity:.27}),'leaf','original'));
 // A hollow lathed pot with a rolled rim, inner wall, foot ring and soil below the lip.
 a.add(lathe([[.075,0],[.153,0],[.163,.018],[.198,.36],[.223,.395],[.226,.414],[.216,.427],[.203,.418],[.201,.39],[.18,.07],[.07,.055]],56),ceramic);
 a.add(new T.TorusGeometry(.217,.008,6,56),ceramic,new T.Vector3(0,.414,0),new T.Euler(Math.PI/2,0,0));
 a.add(new T.CylinderGeometry(.197,.189,.014,40),soil,new T.Vector3(0,.387,0));
 const trunk=[new T.Vector3(0,.386,0),new T.Vector3(.012,.85,.015),new T.Vector3(.04,1.28,-.005),new T.Vector3(.055,1.64,.02)];a.tube(trunk,.017,bark,28);
 for(let i=0;i<18;i++){
  const angle=i*2.39996,yy=.68+i*.052,root=new T.Vector3(.015+(yy-.68)*.035,yy,0),tip=new T.Vector3(root.x+Math.cos(angle)*.23,yy+.075,Math.sin(angle)*.23),length=.33+.1*(.5+.5*Math.sin(i*3.7)),width=.09+.025*(.5+.5*Math.cos(i*4.3));
  a.add(cylinderBetween(root,tip,.0065,.0028,7),bark);
  const local=new T.Matrix4().compose(tip,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(angle)*.76,.45,Math.sin(angle)*.76).normalize()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.sin(i*1.7)*.4)),new T.Vector3(1,1,1));
  const g=new T.PlaneGeometry(1,1,10,14),p=g.attributes.position;
  const leafPoint=(u:number,t:number)=>new T.Vector3(u*Math.pow(Math.max(0,Math.sin(t*Math.PI)),.72)*width,t*length,Math.sin(t*Math.PI)*.035+u*u*.022+Math.sin(t*10+i)*Math.abs(u)*.003);
  for(let j=0;j<p.count;j++){const q=leafPoint(p.getX(j)*2,p.getY(j)+.5);p.setXYZ(j,q.x,q.y,q.z)}g.computeVertexNormals();g.applyMatrix4(local);a.add(g,green[i%3]);
  const central=Array.from({length:9},(_,j)=>leafPoint(0,j/8).add(new T.Vector3(0,0,.001)).applyMatrix4(local));a.tube(central,.00085,vein,16);
  for(let branch=1;branch<=4;branch++)for(const sign of [-1,1]){const t=.16+branch*.135,points=[leafPoint(0,t),leafPoint(sign*.4,t+.07),leafPoint(sign*.85,Math.min(.94,t+.14))].map(v=>v.add(new T.Vector3(0,0,.001)).applyMatrix4(local));a.tube(points,.00035,vein,8)}
 }
 const group=a.finish('fine-fiddle-leaf');group.position.set(x,floorY,z);group.scale.setScalar(scale);return group;
}
export function fineInterior(p:Palette){const group=new T.Group();group.name='fine-interior-assets';group.add(detailedSofa(p),detailedRug(p),detailedTable(p),detailedPlant(1.8,-2.32,1.05,FINISH.floorTop_m),detailedPlant(2.31,1.05,.34,.49));return group}
