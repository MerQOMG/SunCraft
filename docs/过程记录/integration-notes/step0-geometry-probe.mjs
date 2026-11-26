// Minimal real endpoint/adapter probe, not a full test suite or browser run.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../前端文件/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../前端文件/',import.meta.url));
const out=new URL('./geometry-http-evidence/',import.meta.url);await fs.mkdir(out,{recursive:true});
const transport={mode:'api',baseUrl:'http://127.0.0.1:5174'};
const realFetch=globalThis.fetch;let index=0;const entries=[];
globalThis.fetch=async(url,options={})=>{const start=performance.now();try{
 const response=await realFetch(url,options);const raw=await response.clone().text();
 const record={url:String(url),method:options.method||'GET',payload:options.body?JSON.parse(options.body):null,status:response.status,elapsed_ms:Math.round(performance.now()-start),body:JSON.parse(raw)};
 const name=`${String(++index).padStart(2,'0')}-${String(url).split('/').at(-1)}.json`;
 await fs.writeFile(new URL(name,out),JSON.stringify(record,null,2));entries.push({file:name,...record,body:undefined});return response;
 }catch(e){entries.push({url:String(url),error:e.name+': '+e.message});throw e}};
const server=await createServer({root,server:{middlewareMode:true},logLevel:'error'});
try{
 const {api,initialConfig}=await server.ssrLoadModule('/src/api.ts');const {DEFAULTS}=await server.ssrLoadModule('/src/model.ts');const signal=()=>new AbortController().signal;
 const presets=await api.presets(transport,signal());
 const {shadeGeometry,validRoom}=await server.ssrLoadModule('/src/geometry.ts');
 const {default:Section}=await server.ssrLoadModule('/src/Section.tsx');
 const {designSheet}=await server.ssrLoadModule('/src/export.ts');
 const {createElement}=await import('../前端文件/node_modules/react/index.js');
 const {renderToStaticMarkup}=await import('../前端文件/node_modules/react-dom/server.node.js');
 const checks=[];
 for(const ratio of [.25,.27,.4,.45,.5,.54,.65])for(const angle of [0,30,80])for(const depth of [0,1.8]){
  const p={...DEFAULTS,window_wall_ratio:ratio,louver_angle_deg:angle,overhang_depth_m:depth},g=shadeGeometry(p,presets.room);
  if(Math.abs(g.window.width*g.window.height-ratio*presets.room.width_m*presets.room.height_m)>1e-10||g.window.sill!==.45||g.canopy.visible!==(depth>0)||g.blades.some(b=>b.outerHeight>b.rootHeight+1e-10)||g.blades.some((b,i)=>Math.abs(b.rootHeight-(g.window.top-i*.45))>1e-10))throw Error('Shared geometry check failed');
  checks.push({ratio,angle,depth,height:g.window.height,sill:g.window.sill,head:g.window.top,blades:g.blades.length,outerDrop:g.blades[0].rootHeight-g.blades[0].outerHeight,canopy:g.canopy.visible});
 }
 const missing=await server.ssrLoadModule('/src/api.ts');if(missing.validatePresets({cities:presets.cities,daylight_threshold_pct:2}).room)throw Error('Missing metadata silently fell back');
 await fs.writeFile(new URL('geometry-cases.json',out),JSON.stringify({case_count:checks.length,checks,invalid_geometry_rejected:!validRoom({...presets.room,slat_pitch_m:0})},null,2));
 const baseline=await api.simulate(DEFAULTS,transport,signal());
 const section=renderToStaticMarkup(createElement(Section,{room:presets.room,parameters:DEFAULTS,result:baseline,season:'winter',highlightWinter:true}));
 const svg=designSheet(DEFAULTS,baseline,section,'上海','后端计算 / 待专业校核',2,presets.room);
 await fs.writeFile(new URL('default-section.svg',out),section);await fs.writeFile(new URL('default-design-sheet.svg',out),svg);
 if(!section.includes('data-ray-source="backend"')||!svg.includes('宽4.86m')||svg.includes('固定窗宽 4.4'))throw Error('Export contract check failed');
 const extreme=[];for(const p of [{...DEFAULTS,window_wall_ratio:.25,overhang_depth_m:0,louver_angle_deg:0},{...DEFAULTS,window_wall_ratio:.65,overhang_depth_m:1.8,louver_angle_deg:80}]){const r=await api.simulate(p,transport,signal());extreme.push({parameters:p,metrics:r.metrics,score:r.score_report?.total_score});const drawing=renderToStaticMarkup(createElement(Section,{room:presets.room,parameters:p,result:r,season:'winter'}));await fs.writeFile(new URL(`section-wwr-${p.window_wall_ratio}.svg`,out),drawing)}
 await fs.writeFile(new URL('extreme-summary.json',out),JSON.stringify(extreme,null,2));
 const changed=await api.simulate({...DEFAULTS,overhang_depth_m:.45},transport,signal());
 let optimization;try{const result=await api.optimize(DEFAULTS,transport,signal());optimization={parameters:result.parameters,before_score:result.before.score_report?.total_score,after_score:result.after.score_report?.total_score,after_metrics:result.after.metrics,score_error:result.after.score_report_error??null}}catch(e){optimization={error:e.message}}
 const errors={};for(const [name,payload]of [['infeasible',{...DEFAULTS,window_wall_ratio:.25}],['invalid',{...DEFAULTS,latitude:0}]]){try{await (name==='infeasible'?api.optimize:api.simulate)(payload,transport,signal());errors[name]='unexpected success'}catch(e){errors[name]=e.name+': '+e.message}}
 const aborted=new AbortController();aborted.abort();try{await api.simulate(DEFAULTS,transport,aborted.signal)}catch(e){errors.preAborted=e.name+': '+e.message}
 try{await api.presets({...transport,baseUrl:'http://127.0.0.1:65534'},signal())}catch(e){errors.unavailable=e.name+': '+e.message}
 const summary={note:'Real HTTP via 5174 proxy and uploaded frontend api.ts adapters; not browser/UI acceptance, full tests, build or physical validation.',room:presets.room,cities:presets.cities,threshold:presets.daylight_threshold_pct,default_parameters:DEFAULTS,baseline:{metrics:baseline.metrics,solar_angles:baseline.solar_angles,matrix:[baseline.heatmap_grid.length,baseline.heatmap_grid[0].length],score:baseline.score_report?{total:baseline.score_report.total_score,provenance:baseline.score_report.provenance,dimensions:baseline.score_report.dimensions.length,items:baseline.score_report.dimensions.flatMap(d=>d.items).length}:null,score_error:baseline.score_report_error??null},changed:{overhang_depth_m:.45,metrics:changed.metrics,score:changed.score_report?.total_score,score_error:changed.score_report_error??null},optimization,errors,entries};
 await fs.writeFile(new URL('summary.json',out),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{await server.close();globalThis.fetch=realFetch}
