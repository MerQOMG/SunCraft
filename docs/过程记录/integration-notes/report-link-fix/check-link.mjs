import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(path.join(root,'前端文件/package.json'));
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom'});
let n=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);n++;console.log('PASS',label)};
try{
 const {EMPTY_INSPECTION:E,inspectionReducer:r,inspectionTarget:t}=await server.ssrLoadModule('/src/scoring/inspection.ts');
 const depth={key:'winter_depth',target:'winter-depth'},sofa={key:'sofa',target:'sofa'};
 // Transient hover is never promoted by simply opening a report context.
 eq(t(true,'score','winter-depth',E),'winter-depth','Transient score preview remains available');
 eq(t(true,'cases',null,r(E,{type:'navigate',view:'cases'})),null,'Hover alone never pins cases');
 let s=r(E,{type:'focus',owner:depth});eq(s.selected,null,'Focus alone is not persistent selection');
 s=r(s,{type:'navigate',view:'cases'});eq(t(true,'cases',null,s),'winter-depth','Explicit cases navigation transfers focused metric');
 eq(s.candidate,null,'Navigation consumes candidate');
 s=r(s,{type:'forget-candidate'});eq(t(true,'cases',null,s),'winter-depth','Blur/hidden original focus cannot erase activated inspection');
 eq(t(true,'cases','sofa',s),'winter-depth','Transient pointer target cannot steal explicit result');
 eq(t(true,'date',null,s),null,'Selected annotation never leaks into date preview');
 eq(t(false,'cases',null,s),null,'Closed drawer immediately suppresses annotation');
 eq(t(true,'cases',null,r(s,{type:'clear'})),null,'Explicit clear removes persistent annotation');
 for(const view of ['score','date'])eq(r(s,{type:'navigate',view}),E,'Switching to '+view+' resets selected context');
 for(const cause of ['close','new-report','pending','accordion-change'])eq(r(s,{type:'clear'}),E,'Scope invalidation: '+cause);
 eq(r(r(E,{type:'focus',owner:depth}),{type:'forget-candidate'}),E,'Unrelated focus/pointer action forgets unactivated candidate');
 eq(r(r(E,{type:'focus',owner:depth}),{type:'focus',owner:sofa}),E,'Another metric replaces candidate rather than retaining winter');
 for(const input of ['mouse native button','keyboard Enter','keyboard Space']){
  const activated=r(E,{type:'activate',owner:depth});eq(t(true,'cases',null,activated),'winter-depth',input+' shared activation state');
  eq(t(true,'cases',null,r(r(activated,{type:'clear'}),{type:'navigate',view:'cases'})),null,input+' cannot reactivate cleared selection');
 }
 eq(E,{candidate:null,selected:null},'Reducer preserves immutable empty state');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {DimensionAccordion}=await server.ssrLoadModule('/src/scoring/DimensionAccordion.tsx');
 const {EXAMPLE_SCORE_REPORT}=await server.ssrLoadModule('/src/scoring/example.ts');
 const dimension=EXAMPLE_SCORE_REPORT.dimensions.find(d=>d.items.some(i=>i.link_target==='winter-depth'));
 const html=renderToStaticMarkup(React.createElement(DimensionAccordion,{dimension,open:true,onToggle(){},onSpatialAction(){},onInspectDepth(){}}));
 eq(html.includes('查看两至剖面 →'),true,'Explicit visible metric navigation button');
 eq(html.includes('type="button"')&&html.includes('对应的两至剖面并保持定位'),true,'Mouse and keyboard share native button semantics');
 eq(html.includes('Enter查看两至剖面'),true,'Focusable metric announces activation shortcut');
 for(const route of ['/src/scoring/ScoreDrawer.tsx','/src/scoring/DimensionAccordion.tsx','/src/scoring/inspection.ts','/src/scoring/scoring.css'])eq((await fetch('http://127.0.0.1:5174'+route)).status,200,'Dev module HTTP '+route);
 console.log(n+' targeted state/SSR/HTTP checks passed; no browser/full suite/build.');
}finally{await server.close()}
