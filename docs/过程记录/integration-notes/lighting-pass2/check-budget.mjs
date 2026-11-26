import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../../前端文件/node_modules/vite/dist/node/index.js';
const server=await createServer({root:fileURLToPath(new URL('../../前端文件/',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},logLevel:'error',appType:'custom'});
try{
 const {lightingBudget,LIGHTING,apertureSkyFraction,floorSunFraction}=await server.ssrLoadModule('/src/lighting.ts');
 const {annualSolarFrame,dayFromDate}=await server.ssrLoadModule('/src/annual.ts');
 const {DEFAULTS}=await server.ssrLoadModule('/src/model.ts');
 const {EXAMPLE_ROOM:room}=await server.ssrLoadModule('/src/geometry.ts');
 const {solarNoon}=await server.ssrLoadModule('/src/solar.ts');
 const prev={environment:.07,skyRadiance:11,skyKelvin:6800,floorFluxShare:.36,northFluxShare:.06,wait:0,aoRadius_m:.11,aoIntensity:.35,exposure:1.10,sunIntensity:5.3,floorReflectance:.48};
 // northFluxShare previous was 0.12
 const prevNorth=.12,prevFloorShare=.36,prevSun=5.3,prevSky=11;
 const cases=[['default-summer','2026-06-21',31.2,DEFAULTS],['default-winter','2026-12-22',31.2,DEFAULTS],['spring-equinox','2026-03-20',31.2,DEFAULTS],['guangzhou-north','2026-06-21',23.1,{...DEFAULTS,city_id:'guangzhou',latitude:23.1}],['max-shading','2026-12-22',31.2,{...DEFAULTS,overhang_depth_m:1.8,window_wall_ratio:.65,louver_angle_deg:80}]];
 const rows=[],fails=[];
 const ok=(c,m)=>{if(!c)fails.push(m);else console.log('PASS',m)};
 ok(LIGHTING.exposure===1.1,'Exposure stays 1.10, no global lift');
 ok(LIGHTING.environment===.03&&LIGHTING.skyRadiance===15.5&&LIGHTING.floorFluxShare===.18&&LIGHTING.northFluxShare===.06,'Rebalance constants as specified');
 ok(LIGHTING.aoRadius_m===.08&&LIGHTING.aoIntensity===.45&&LIGHTING.aoMaxDimension===900,'Tighter AO, same buffer cap, no new pass');
 ok(LIGHTING.floorFluxShare+LIGHTING.northFluxShare<1,'Bounce shares remain a partial split');
 for(const [name,date,lat,p] of cases){
  const frame=annualSolarFrame(dayFromDate(date),lat),b=lightingBudget(p,'annual',frame.direction,room);
  const area=room.width_m*room.height_m*p.window_wall_ratio;
  const priorPortal=prevSky*b.skyFraction;
  const priorFloor=priorPortal*area/(room.width_m*room.depth_m)*prevFloorShare*.48+prevSun*Math.max(0,frame.direction.y)*b.sunFloorFraction*.48/Math.PI;
  const priorNorth=priorPortal*area/(room.width_m*room.height_m)*prevNorth*.76;
  if(![b.exposure,b.environment,b.portal,b.floorBounce,b.northBounce,b.sunFloorFraction,b.sunIntensity].every(v=>Number.isFinite(v)&&v>=0))fails.push('Nonfinite '+name);
  if(b.exposure!==1.1)fails.push('Exposure drifted '+name);
  if(!frame.south&&b.sunFloorFraction!==0)fails.push('Invented north-side sun-floor '+name);
  rows.push({name,date,latitude:lat,altitude:frame.altitude,south:frame.south,parameters:p,renderOnlyApproximation:true,sunFloorFraction:b.sunFloorFraction,skyFraction:b.skyFraction,before:{environment:.07,portal:priorPortal,floorBounce:priorFloor,northBounce:priorNorth,skyKelvin:6800,aoRadius_m:.11,aoIntensity:.35,exposure:1.1,sunIntensity:5.3},after:{environment:b.environment,portal:b.portal,floorBounce:b.floorBounce,northBounce:b.northBounce,skyKelvin:LIGHTING.skyKelvin,aoRadius_m:LIGHTING.aoRadius_m,aoIntensity:LIGHTING.aoIntensity,exposure:b.exposure,sunIntensity:b.sunIntensity}});
 }
 const summer=rows.find(r=>r.name==='default-summer'),winter=rows.find(r=>r.name==='default-winter'),gz=rows.find(r=>r.name==='guangzhou-north');
 ok(summer.sunFloorFraction===0,'Default summer 0° still has no floor direct fraction');
 ok(gz.south===false&&gz.sunFloorFraction===0,'Guangzhou summer has no south-facade direct floor');
 ok(winter.sunFloorFraction>0&&winter.sunFloorFraction<1,'Winter floor sun fraction remains a real partial opening');
 ok(summer.after.portal>summer.before.portal,'Window key portal increased');
 ok(summer.after.floorBounce<summer.before.floorBounce&&summer.after.northBounce<summer.before.northBounce,'Summer undirected bounce decreased');
 ok(summer.after.environment<summer.before.environment,'Undirected IBL decreased');
 ok(winter.after.sunIntensity===6.2,'Annual direct intensity is the shared 6.2 path');
 const winterDir=annualSolarFrame(dayFromDate('2026-12-22'),31.2).direction;
 ok(Math.abs(winter.sunFloorFraction-floorSunFraction(DEFAULTS,winterDir,room))<1e-12,'Winter fraction comes from unchanged geometry sampler');
 ok(winter.after.portal>winter.before.portal,'Winter portal also increased (sky, not a fake beam)');
 const below=lightingBudget(DEFAULTS,'annual',{x:0,y:-.2,z:-.98},room);
 ok([below.environment,below.portal,below.floorBounce,below.northBounce,below.sunIntensity].every(v=>v===0),'Daylight fill off below horizon');
 const open=apertureSkyFraction({...DEFAULTS,overhang_depth_m:0},room),deep=apertureSkyFraction({...DEFAULTS,overhang_depth_m:1.8},room);
 ok(deep<open,'Canopy still reduces sky fraction via real geometry');
 ok(floorSunFraction(DEFAULTS,solarNoon(DEFAULTS.latitude,'summer').direction,room)===0,'solarNoon summer floor fraction is 0');
 for(const route of ['/src/lighting.ts','/src/Scene.tsx']){
  const response=await fetch('http://127.0.0.1:5174'+route);ok(response.status===200,'HTTP 200 '+route);
 }
 if(fails.length){console.error(fails);throw Error(fails.join('; '))}
 await fs.writeFile(new URL('budget-report.json',import.meta.url),JSON.stringify({note:'Render budget math only, NOT exposure/lux/GI/GPU/screenshot validation. Before coefficients are the previous closed lighting pass, not a physical baseline.',cases:rows,belowHorizonDaylightOff:true,bufferCap:LIGHTING.aoMaxDimension,newLightsOrPasses:0,sceneChanges:'windowLight.color now follows LIGHTING.skyKelvin in the existing budget tick; no new lights, cameras, or passes.'},null,2));
 console.log(rows.map(r=>({name:r.name,alt:r.altitude.toFixed(2),south:r.south,portal:[+r.before.portal.toFixed(4),+r.after.portal.toFixed(4)],floor:[+r.before.floorBounce.toFixed(4),+r.after.floorBounce.toFixed(4)],north:[+r.before.northBounce.toFixed(4),+r.after.northBounce.toFixed(4)],floorFrac:+r.sunFloorFraction.toFixed(4),sun:r.after.sunIntensity})));
 console.log('Budget checks passed; not a visual review.');
}finally{await server.close()}
