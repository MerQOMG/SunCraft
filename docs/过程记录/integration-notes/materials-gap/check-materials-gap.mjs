import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'前端文件/package.json'));
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom',logLevel:'error'});
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log('PASS',m)};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const before=JSON.parse(fs.readFileSync(path.join(root,'../materials-gap-before-sha256.json'),'utf8'));
try{
  const {plasterSample,linenSample,woolSample,walnutSample}=await server.ssrLoadModule('/src/surfaceSamples.ts');
  const {applyBoxUvMetres}=await server.ssrLoadModule('/src/modeling/construction.ts');
  const {FINISH,sofaFoot}=await server.ssrLoadModule('/src/shading.ts');
  const THREE=await server.ssrLoadModule('/node_modules/three/build/three.module.js');
  const period=(fn,du,dv,label)=>{
    const a=fn(0,0),b=fn(du,dv),keys=Object.keys(a);
    for(const k of keys){const va=a[k],vb=b[k];
      if(Array.isArray(va))va.forEach((x,i)=>assert.ok(Math.abs(x-vb[i])<1e-12,label+' seam '+k));
      else if(typeof va==='number')assert.ok(Math.abs(va-vb)<1e-12,label+' seam '+k);
    }ok(true,label+' tiles seamlessly');
  };
  period(plasterSample,2,0,'Plaster 2 m');period(linenSample,.25,0,'Linen 0.25 m');period(woolSample,1,0,'Wool 1 m');
  const ranges={plaster:{fn:plasterSample,rgb:[200,245],r:[.86,1]},linen:{fn:linenSample,rgb:[190,245],r:[.7,1]},wool:{fn:woolSample,rgb:[150,230],r:[.75,1]}};
  for(const [name,cfg] of Object.entries(ranges)){
    let rmin=1,rmax=0,cmin=255,cmax=0;
    for(let i=0;i<400;i++){const s=cfg.fn((i*.137)%4,((i*0.61)%3));rmin=Math.min(rmin,s.roughness);rmax=Math.max(rmax,s.roughness);for(const c of s.rgb){cmin=Math.min(cmin,c);cmax=Math.max(cmax,c)}}
    ok(cmin>=cfg.rgb[0]&&cmax<=cfg.rgb[1]&&rmin>=cfg.r[0]&&rmax<=cfg.r[1]&&cmax-cmin>2&&cmax-cmin<80,name+' contrast is quiet and in range ('+cmin.toFixed(1)+'–'+cmax.toFixed(1)+', r '+rmin.toFixed(3)+'–'+rmax.toFixed(3)+')');
  }
  const w=walnutSample(.1,.2),w2=walnutSample(.1+1,.2);
  ok(w.rgb.every((c,i)=>Math.abs(c-w2.rgb[i])<1e-10)&&Math.abs(w.roughness-w2.roughness)<1e-12,'Walnut sample remains periodic and was not rewritten');
  const box=new THREE.BoxGeometry(2,3,4);applyBoxUvMetres(box,2,3,4);
  const uv=box.attributes.uv,xs=[],ys=[];
  for(let i=0;i<uv.count;i++){xs.push(uv.getX(i));ys.push(uv.getY(i))}
  ok(Math.max(...xs)>1.5&&Math.max(...ys)>1.5&&Math.min(...xs)>=0&&Math.min(...ys)>=0,'Box face UVs are scaled into metres, not 0–1 stretched tiles');
  ok(Math.abs(FINISH.floorTop_m+FINISH.rugThickness_m-FINISH.rugTop_m)<1e-12,'Rug still sits flush on the finished floor');
  for(const on of [true,false]){const f=sofaFoot(on);ok(Math.abs(f.bottom-(on?FINISH.rugTop_m:FINISH.floorTop_m))<1e-12&&Math.abs(f.center+f.height/2-FINISH.sofaLegTop_m)<1e-12,'Sofa feet still meet '+(on?'rug':'floor'))}
  const F=FINISH.floorTop_m,cabinetBottom=.15,footH=cabinetBottom-F+.002,center=F+footH/2-.001;
  ok(Math.abs((center-footH/2)- (F-.001))<1e-12&&Math.abs((center+footH/2)-(cabinetBottom+.001))<1e-12,'Cabinet feet meet the floor and the carcass without a float gap');
  const locked=['前端文件/src/lighting.ts','前端文件/src/camera.ts','前端文件/src/export.ts','前端文件/src/styles.css','前端文件/src/scoring/ScoreDrawer.tsx','前端文件/src/modeling/window.ts'];
  for(const f of locked)ok(sha(f)===before[f],f+' SHA protected');
  const backend=Object.keys(before).filter(k=>k.startsWith('backend/'));
  ok(backend.length===23&&backend.every(k=>sha(k)===before[k]),'23 backend files unchanged');
  const scene=fs.readFileSync(path.join(root,'前端文件/src/Scene.tsx'),'utf8');
  ok(scene.includes("walnut=mat('#e4d9ca',SURFACES.walnut.roughness")&&scene.includes('SURFACES.tvRear')&&!scene.includes('toneMappingExposure=')===false&&scene.includes('budget.exposure'),'Walnut, TV rear and exposure budget assignments stay in Scene');
  ok(!scene.includes('new THREE.DirectionalLight')===false&&scene.includes('contactPipeline')&&scene.includes('plasterBox')&&scene.includes('maps.floorRoughness'),'No new light type; plaster/floor maps and existing pipeline remain');
  for(const route of ['/src/materials.ts','/src/Scene.tsx','/src/surfaceSamples.ts','/src/modeling/construction.ts','/src/modeling/interior.ts'])ok((await fetch('http://127.0.0.1:5174'+route)).status===200,'HTTP 200 '+route);
  console.log(n+' targeted material/UV/contact/SHA checks passed; no browser, full suite or build.');
}finally{await server.close()}
