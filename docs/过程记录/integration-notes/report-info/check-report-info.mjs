import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'前端文件/package.json'));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom'});
let fixtures=0,assertions=0;const check=(condition,message)=>{assert.ok(condition,message);assertions++};
try {
 const {ScoreDrawer}=await server.ssrLoadModule('/src/scoring/ScoreDrawer.tsx');
 const {EXAMPLE_SCORE_REPORT:example}=await server.ssrLoadModule('/src/scoring/example.ts');
 const real={...example,provenance:'backend'},partial={...real,completeness:'partial'};
 const variants=[{report:real},{report:example},{report:null},{report:partial},{report:real,pending:true},{report:real,error:'SCORE_ERROR_MARKER'},{report:real,busy:true},{report:real,open:false}];
 for(const view of ['score','date','cases'])for(const variant of variants){
  const input=JSON.stringify(variant);
  const props={view,open:true,pending:false,busy:false,canOptimize:true,onClose(){},onHighlight(){},onOptimize(){},onCancel(){},...variant,
   applicability:React.createElement('p',{role:'note'},'GZ_APPLICABILITY_0/20'),
   simulationNotice:React.createElement('p',{role:'alert'},'API_ERROR_MARKER'),
   preview:React.createElement('svg',{id:'date-section-drawing','data-solar-date':'2026-06-26'}),
   children:React.createElement('svg',{id:'section-drawing'})};
  const html=renderToStaticMarkup(React.createElement(ScoreDrawer,props));fixtures++;
  check(JSON.stringify(variant)===input,'Rendering must not mutate reports');
  for(const id of ['score','date','cases']){
   const panel=html.match(new RegExp(`<section(?=[^>]*id="report-panel-${id}")[^>]*>`))?.[0];
   check(!!panel&&panel.includes('role="tabpanel"')&&panel.includes(`aria-labelledby="report-tab-${id}"`),'Mounted labelled panel '+id);
   check(panel.includes('hidden=""')===(view!==id),'Only selected context visible '+id);
   const tab=html.match(new RegExp(`<button(?=[^>]*id="report-tab-${id}")[^>]*>`))?.[0];
   check(!!tab&&tab.includes(`aria-controls="report-panel-${id}"`)&&tab.includes(`aria-selected="${view===id}"`)&&tab.includes(`tabindex="${view===id?0:-1}"`),'Roving tab semantics '+id);
  }
  for(const id of ['date-section-drawing','section-drawing']){
   check((html.match(new RegExp(`id="${id}"`,'g'))??[]).length===1,'Both original export SVG IDs mounted uniquely');
   check(!html.match(new RegExp(`<svg(?=[^>]*id="${id}")[^>]*hidden`)),'SVG itself must not carry hidden attribute');
  }
  check(html.includes('GZ_APPLICABILITY_0/20')&&html.indexOf('GZ_APPLICABILITY_0/20')<html.indexOf('id="report-panel-score"'),'Applicability stays common, including original contribution');
  check(html.includes('API_ERROR_MARKER')&&html.indexOf('API_ERROR_MARKER')<html.indexOf('id="report-panel-score"'),'Simulation error stays common');
  check(html.includes('score-optimize'),'Optimize remains common');
  if(variant.busy)check(html.includes('取消寻优'),'Busy cancel remains available');
  if(variant.error)check(html.includes('SCORE_ERROR_MARKER'),'Score failure retained');
  if(variant.report===example)check(html.includes('独立评分示例')&&html.includes('演示两至工况'),'Example is not labelled a real backend calculation');
  if(variant.report===partial)check(html.includes('报告不完整'),'Partial report warning retained');
  if(variant.report===null)check(html.includes('未提供 score_report'),'Old API without score report retained');
 }
 for(const route of ['/src/App.tsx','/src/scoring/ScoreDrawer.tsx','/src/scoring/scoring.css','/src/export.ts']){
  const response=await fetch('http://127.0.0.1:5174'+route);check(response.status===200,'Existing dev module HTTP 200 '+route);console.log('HTTP',response.status,route);
 }
 console.log(`${fixtures} targeted SSR fixtures / ${assertions} semantic+HTTP assertions passed; no browser, build or full suite.`);
} finally {await server.close()}
