import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Parameters, Season, Simulation } from './model';
import { windowGeometry } from './model';
import { solarNoon } from './solar';
import { LOUVER, FINISH } from './shading';
import { materialTextures } from './materials';
import { fineInterior } from './modeling/interior';
import { fineWindow } from './modeling/window';
import { meshInventory } from './modeling/construction';
import { cameraPose } from './camera';
import type { CameraView } from './camera';
import type {LinkTarget} from './scoring/report';
import { LIGHTING,lightingBudget,kelvinColor } from './lighting';
import { contactPipeline } from './contactAO';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
interface Props {highlight:LinkTarget|null;cameraView:CameraView; parameters:Parameters; season:Season; heat:boolean; result:Simulation|null; resetToken:number; resultCurrent:boolean; onReady:()=>void}
let areaLightingReady=false;
type Live = Pick<Props,'parameters'|'season'|'heat'|'result'|'resultCurrent'|'highlight'>;
export default function Scene(props:Props) {
 const host=useRef<HTMLDivElement>(null),live=useRef<Live>(props),reset=useRef<()=>void>(()=>{}),ready=useRef(props.onReady),cameraView=useRef(props.cameraView);live.current=props;cameraView.current=props.cameraView;
 const [failure,setFailure]=useState('');
 useEffect(()=>{reset.current()},[props.resetToken,props.cameraView]);
 useEffect(()=>{
 const el=host.current!;let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'})}catch{setFailure('当前浏览器无法启用 WebGL，参数与剖面仍可使用。请开启硬件加速后重试。');return}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=LIGHTING.exposure;renderer.setClearColor(0xeeeae2,0);el.appendChild(renderer.domElement);
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(9.3,7.4,10.2);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.05,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=3.8;controls.maxDistance=25;controls.maxPolarAngle=Math.PI/2.12;controls.minPolarAngle=.24;controls.enablePan=true;controls.screenSpacePanning=true;
 let applySection=()=>{};
 const fitCamera=()=>{const aspect=Math.max(el.clientWidth/Math.max(el.clientHeight,1),.4),pose=cameraPose(cameraView.current,aspect);const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.fov=pose.fov;camera.aspect=aspect;camera.updateProjectionMatrix();controls.maxDistance=pose.maxDistance;controls.target.copy(pose.target);camera.position.copy(pose.position);controls.update();controls.enableDamping=damping;applySection();el.dataset.cameraView=cameraView.current;renderer.shadowMap.needsUpdate=true};reset.current=fitCamera;
 const maps=materialTextures();
 const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(environment,.04);scene.environment=env.texture;scene.environmentIntensity=LIGHTING.environment;environment.dispose();pmrem.dispose();
 const mat=(color:THREE.ColorRepresentation,roughness=.8,extra:THREE.MeshStandardMaterialParameters={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
 const plaster=mat('#e2dfd7',.95),ceiling=mat('#f4f3ed',1),trim=mat('#eeeae2'),oak=mat('#ffffff',.82,{map:maps.floor,bumpMap:maps.floor,bumpScale:.00035}),walnut=mat('#e4d9ca',.66,{map:maps.walnut}),fabric=new THREE.MeshPhysicalMaterial({color:'#e1dbd0',roughness:1,roughnessMap:maps.fabricRoughness,map:maps.fabric,bumpMap:maps.fabricBump,bumpScale:.00032,specularIntensity:.18,sheen:.10,sheenRoughness:1,sheenColor:new THREE.Color('#d7d1c7')}),dark=mat('#343735',.55),metal=mat('#79807b',.4,{metalness:.72});
 const geometries:THREE.BufferGeometry[]=[];const materials:THREE.Material[]=[];
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=scene,radius=0){const g=radius?new RoundedBoxGeometry(w,h,d,5,radius):new THREE.BoxGeometry(w,h,d);geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function cylinder(rt:number,rb:number,h:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=scene){const g=new THREE.CylinderGeometry(rt,rb,h,40);geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 const sun=new THREE.DirectionalLight('#fff8e9',4.6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.camera.near=.1;sun.shadow.camera.far=50;sun.shadow.normalBias=.006;sun.shadow.bias=-.00008;sun.shadow.radius=1.5;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);scene.add(sun.target);
 // Aperture-origin diffuse light, then bounded first-bounce surfaces. No fake direct sun patches.
 if(!areaLightingReady){RectAreaLightUniformsLib.init();areaLightingReady=true}
 const windowLight=new THREE.RectAreaLight(kelvinColor(7500),1,4.3,1.6);windowLight.position.set(0,1.5,-2.96);windowLight.lookAt(0,1.5,0);scene.add(windowLight);
 const floorBounce=new THREE.RectAreaLight('#f0dfc7',.2,5.1,5.6);floorBounce.position.set(0,.075,0);floorBounce.up.set(0,0,1);floorBounce.lookAt(0,3,0);scene.add(floorBounce);
 const northBounce=new THREE.RectAreaLight('#f4f1e8',.2,5.2,2.7);northBounce.position.set(0,1.5,2.94);northBounce.lookAt(0,1.5,0);scene.add(northBounce);
 // 5.4 × 6.0 m room; +Z points north/inward, south window is Z=-3.
 box(5.65,.22,6.25,0,-.16,0,mat('#8e8478'));box(5.4,.09,6,0,-.005,0,mat('#ac9a82'));
 const floorGeo=new THREE.PlaneGeometry(5.4,6);geometries.push(floorGeo);const floor=new THREE.Mesh(floorGeo,oak);floor.rotation.x=-Math.PI/2;floor.position.y=FINISH.floorTop_m;floor.receiveShadow=true;scene.add(floor);
 // Visible cutaway, physically closed shadow envelope: no imaginary skylight.
 const shadowOnly=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
 const roof=box(5.56,.12,6.16,0,3.06,0,shadowOnly);box(5.56,3,.12,0,1.5,3.06,shadowOnly);const eastWall=box(.12,3,6.16,2.76,1.5,0,shadowOnly);
 // Same physical enclosure and shadow casting in both views: only the section display differs.
 // Interior: cut north wall, see ceiling/east wall. Analysis: original roof/east cutaway.
 applySection=()=>{roof.material=shadowOnly;eastWall.material=shadowOnly};
 box(.16,3,6,-2.78,1.5,0,plaster);box(.04,.105,6,-2.68,.0935,0,trim,scene,.003);box(.008,.008,6,-2.656,.151,0,dark);
 // South wall is split around the variable-height opening (no scaled furniture).
 box(.5,3,.16,-2.45,1.5,-3.08,plaster);box(.5,3,.16,2.45,1.5,-3.08,plaster);
 const upper=box(4.4,1,.16,0,2.8,-3.08,plaster),lower=box(4.4,1,.16,0,.2,-3.08,plaster);
 const frame=new THREE.Group();scene.add(frame);
 const frameSides=[box(.055,1,.1,-2.2,1.5,-3,shadowOnly,frame),box(.055,1,.1,2.2,1.5,-3,shadowOnly,frame)];
 const frameTop=box(4.5,.055,.12,0,2.5,-3,shadowOnly,frame),frameBottom=box(4.5,.055,.14,0,.5,-3,shadowOnly,frame);
 const mullions=[-.74,.74].map(x=>box(.035,1,.07,x,1.5,-3,shadowOnly,frame));
 const glass=box(4.4,1,.012,0,1.5,-3.02,new THREE.MeshPhysicalMaterial({color:'#aecbd0',transparent:true,opacity:.1,roughness:.08,metalness:0,depthWrite:false}));glass.castShadow=false;glass.receiveShadow=false;
 const sill=box(4.6,.065,.35,0,.5,-2.97,trim);
 const overhang=box(4.9,.12,1,0,2.7,-3.2,metal);
 const louvers=Array.from({length:LOUVER.count},()=>box(4.4,LOUVER.thickness_m,LOUVER.chord_m,0,1.5,-3-LOUVER.offset_m,metal,scene,.0025));
 const refined=fineInterior({fabric,walnut,dark,metal,fabricMap:maps.fabric,fabricBump:maps.fabricBump,rugMap:maps.rug,rugBump:maps.rugBump,rugRoughness:maps.rugRoughness});scene.add(refined);
 // Selection outline is an analysis annotation, not a light/emissive patch; it casts no shadows.
 const sofaBounds=new THREE.Box3().setFromObject(refined.getObjectByName('detailed-sofa')!);sofaBounds.expandByScalar(.035);
 const sofaHint=new THREE.Box3Helper(sofaBounds,new THREE.Color('#6d9a8a'));const hintMaterial=sofaHint.material as THREE.LineBasicMaterial;hintMaterial.transparent=true;hintMaterial.opacity=.7;hintMaterial.depthWrite=false;hintMaterial.toneMapped=false;sofaHint.visible=false;sofaHint.renderOrder=5;scene.add(sofaHint);geometries.push(sofaHint.geometry);materials.push(hintMaterial);
 const windowDetails=fineWindow();scene.add(windowDetails.group);
 // Low media cabinet on the cutaway east wall; TV faces the sofa.
 box(.48,.34,3.3,2.31,.32,-.2,walnut,scene,.018);
 for(let z=-1.5;z<1.3;z+=.73)box(.016,.25,.012,2.045,.35,z,dark);
 for(let z=-1.55;z<1.3;z+=2.7)box(.35,.13,.07,2.3,.08,z,dark);
 box(.038,.90,1.65,2.31,.965,-.5,dark,scene,.012);
 const screen=box(.008,.81,1.54,2.286,.972,-.5,mat('#25312f',.2,{metalness:.12}),scene,.008);screen.castShadow=false;
 box(.23,.025,.4,2.3,.5025,-.5,dark);
 // Walnut side table, ceramic lamp and architectural artwork.
 cylinder(.30,.30,.06,-1.98,.58,-2.35,walnut);cylinder(.09,.13,.52,-1.98,.29,-2.35,walnut);
 cylinder(.11,.14,.23,-1.98,.72,-2.35,mat('#aaa18d'));const shadeG=new THREE.ConeGeometry(.26,.32,48,1,true);geometries.push(shadeG);const lamp=new THREE.Mesh(shadeG,mat('#f1e7cf',.9,{side:THREE.DoubleSide}));lamp.position.set(-1.98,1,-2.35);scene.add(lamp);
 box(.055,1.13,.91,-2.66,1.9,.3,walnut);box(.015,.99,.77,-2.62,1.9,.3,mat('#e8ddc5'));
 const art=box(.02,.58,.32,-2.601,1.88,.17,mat('#9a603e'),scene,.12);art.rotation.x=.18;
 box(.025,.19,.4,-2.59,1.56,.4,mat('#778171'));
 // Curtain stacks sit to the sides, not over the variable window.
 for(const side of [-1,1])for(let i=0;i<7;i++)cylinder(.045,.045,2.65,side*(2.28+i*.043),1.51,-2.83,mat('#d1c9b8',1));
 box(5.15,.045,.045,0,2.91,-2.81,dark);
 // Display base and north arrow are intentionally outside the room envelope.
 const ground=box(200,.05,200,0,-.33,0,new THREE.ShadowMaterial({color:'#454844',opacity:.2}));ground.castShadow=false;
 const heatCanvas=document.createElement('canvas');heatCanvas.width=heatCanvas.height=384;const hc=heatCanvas.getContext('2d')!;const heatTex=new THREE.CanvasTexture(heatCanvas);heatTex.colorSpace=THREE.SRGBColorSpace;const heatMat=new THREE.MeshBasicMaterial({map:heatTex,transparent:true,opacity:.48,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const heatMesh=new THREE.Mesh(new THREE.PlaneGeometry(5.39,5.99),heatMat);geometries.push(heatMesh.geometry);heatMesh.rotation.x=-Math.PI/2;heatMesh.position.set(0,FINISH.rugTop_m+.005,0);heatMesh.renderOrder=1;scene.add(heatMesh);
 const inventory=meshInventory(scene);el.dataset.modelInventory=JSON.stringify(inventory);
 const post=renderer.extensions.has('EXT_color_buffer_float')?contactPipeline(renderer,scene,camera):null;el.dataset.contactAO=post?'geometry-depth-gtao':'unavailable';
 let lastGrid:Simulation['heatmap_grid']|undefined,lastKey='',frameId=0,visible=true,needsRender=true;controls.addEventListener('change',()=>{needsRender=true});const observer=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);post?.resize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();needsRender=true;fitCamera()});observer.observe(el);
 const onVisibility=()=>{visible=!document.hidden};document.addEventListener('visibilitychange',onVisibility);
 const contextLost=(e:Event)=>{e.preventDefault();setFailure('3D 渲染上下文已丢失，请刷新页面。参数与 SVG 剖面仍可使用。')};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 function tick(){frameId=requestAnimationFrame(tick);if(!visible)return;const {parameters:p,season,heat,result,resultCurrent,highlight}=live.current;if(sofaHint.visible!==(highlight==='sofa')){sofaHint.visible=highlight==='sofa';needsRender=true;el.dataset.analysisHighlight=highlight??'none'};const key=JSON.stringify([p,season,resultCurrent?result?.solar_angles:null]);if(key!==lastKey){lastKey=key;needsRender=true;renderer.shadowMap.needsUpdate=true;const win=windowGeometry(p.window_wall_ratio);upper.scale.y=3-win.top;upper.position.y=(3+win.top)/2;lower.scale.y=win.sill;lower.position.y=win.sill/2;frameTop.position.y=win.top;frameBottom.position.y=win.sill;sill.position.y=win.sill-.04;[...frameSides,...mullions,glass].forEach(m=>{m.scale.y=win.height;m.position.y=1.5});overhang.scale.z=Math.max(.015,p.overhang_depth_m);overhang.position.set(0,win.top+.12,-3.1-p.overhang_depth_m/2);louvers.forEach((m,i)=>{m.position.y=win.sill+(i+.5)*win.height/LOUVER.count;m.rotation.x=p.louver_angle_deg*Math.PI/180});windowDetails.update(win,p.louver_angle_deg);const solar=solarNoon(p.latitude,season,resultCurrent?result?.solar_angles:undefined);sun.position.set(solar.direction.x*15,solar.direction.y*15,solar.direction.z*15);sun.target.position.set(0,0,0);const budget=lightingBudget(p,season,solar.direction);sun.color.copy(budget.sunColor);sun.intensity=budget.sunIntensity;windowLight.height=Math.max(.1,win.height-.055);windowLight.intensity=budget.portal;floorBounce.intensity=budget.floorBounce;northBounce.intensity=budget.northBounce;renderer.toneMappingExposure=budget.exposure;el.dataset.lightingApproximation=JSON.stringify({skyVisibility:budget.skyFraction,floorBounce:budget.floorBounce,northBounce:budget.northBounce,exposure:budget.exposure})}
 const showHeat=heat&&!!result;if(heatMesh.visible!==showHeat)needsRender=true;heatMesh.visible=showHeat;if(result&&result.heatmap_grid!==lastGrid){needsRender=true;lastGrid=result.heatmap_grid;const small=document.createElement('canvas');small.width=result.heatmap_grid[0].length;small.height=result.heatmap_grid.length;const sc=small.getContext('2d')!;for(let z=0;z<small.height;z++)for(let x=0;x<small.width;x++){const value=result.heatmap_grid[z][x];const color=new THREE.Color().setHSL((1-Math.min(value/5,1))*.65,.75,.53);sc.fillStyle=`#${color.getHexString(THREE.SRGBColorSpace)}`;sc.fillRect(x,z,1,1)}hc.clearRect(0,0,384,384);hc.imageSmoothingEnabled=true;hc.filter='blur(6px)';hc.drawImage(small,-8,-8,400,400);heatTex.needsUpdate=true}
 controls.update();if(needsRender){if(post)post.render(showHeat);else renderer.render(scene,camera);needsRender=false}}
 renderer.setSize(el.clientWidth,el.clientHeight,false);post?.resize(el.clientWidth,el.clientHeight);fitCamera();tick();ready.current();
 return()=>{cancelAnimationFrame(frameId);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);renderer.domElement.removeEventListener('webglcontextlost',contextLost);controls.dispose();post?.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.push(o.geometry);if(o instanceof THREE.InstancedMesh)o.dispose();const m=Array.isArray(o.material)?o.material:[o.material];materials.push(...m)}});materials.push(ceiling,plaster,shadowOnly);new Set(materials).forEach(m=>m.dispose());new Set(geometries).forEach(g=>g.dispose());Object.values(maps).forEach(t=>t.dispose());env.dispose();heatTex.dispose();sun.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove()};
 },[]);
 return <div ref={host} className="scene" aria-label="固定尺寸南向精装客厅三维模型">{failure&&<div className="scene-error" role="alert">{failure}</div>}</div>;
}
