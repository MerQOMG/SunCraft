import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const notes=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.join(root,'前端文件/package.json'));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const {Resvg}=await import('/workspace/suncraft-upload-20261125-2314/raster-tools/node_modules/@resvg/resvg-js/index.js');
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom',logLevel:'error'});
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log('PASS',m)};
function texts(svg){return [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'))}
function ids(svg){const all=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const dups=[...new Set(all.filter((id,i)=>all.indexOf(id)!==i))];return {all,dups}}
function raster(svg,out){
  const r=new Resvg(svg,{fitTo:{mode:'width',value:1120},background:'#f7f7f2',font:{loadSystemFonts:true,fontFiles:[
    '/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],defaultFontFamily:'Noto Sans CJK SC'}});
  fs.writeFileSync(out,r.render().asPng());
}
try{
  const {designSheet,currentExportResult}=await server.ssrLoadModule('/src/export.ts');
  const Section=(await server.ssrLoadModule('/src/Section.tsx')).default;
  const {annualSolarFrame,SUMMER_DAY,WINTER_DAY}=await server.ssrLoadModule('/src/annual.ts');
  const {DEFAULTS}=await server.ssrLoadModule('/src/model.ts');
  const shanghai=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-shanghai.json'),'utf8'));
  const guangzhou=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-guangzhou.json'),'utf8'));
  const presets=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-presets.json'),'utf8'));
  const room=presets.room,app=fs.readFileSync(path.join(root,'前端文件/src/App.tsx'),'utf8');
  ok(currentExportResult(shanghai,false,false)===shanghai,'Valid current result is exportable');
  ok(currentExportResult(shanghai,true,false)===null&&currentExportResult(shanghai,false,'无法连接计算服务')===null&&currentExportResult(null,false,false)===null,'Pending, error or missing result is not treated as currently valid');
  ok(app.includes('const current=currentExportResult(c.result,c.pending,c.hasError)')&&app.includes('result:current,dateSvg')&&app.includes('disabled={!currentExportResult(result,pending,!!hasError)}'),'Export button and snapshot use the current-valid result only');
  function sheetFor(p,result,day,city,mode){
    const frame=annualSolarFrame(day,p.latitude);
    const markup=renderToStaticMarkup(React.createElement(React.Fragment,null,
      React.createElement(Section,{drawingId:'date-section-drawing',previewFrame:frame,room,parameters:p,result:null,season:frame.declination>=0?'summer':'winter'}),
      React.createElement(Section,{drawingId:'section-drawing',room,parameters:p,result,season:frame.declination>=0?'summer':'winter'}),
    ));
    const svgs=markup.match(/<svg[\s\S]*?<\/svg>/g)||[];
    assert.equal(svgs.length,2);
    return {frame,sheet:designSheet(p,result,svgs[0],city,mode,presets.daylight_threshold_pct,room,frame,svgs[1]),dateSvg:svgs[0],backendSvg:svgs[1]};
  }
  const sh=sheetFor({...DEFAULTS},shanghai,SUMMER_DAY,'上海 / 同济','后端计算 / 待专业校核');
  const gz=sheetFor({...DEFAULTS,city_id:'guangzhou',latitude:23.1},guangzhou,SUMMER_DAY,'广州','后端计算 / 待专业校核');
  const gzw=sheetFor({...DEFAULTS,city_id:'guangzhou',latitude:23.1},guangzhou,WINTER_DAY,'广州','后端计算 / 待专业校核');
  const mock=sheetFor({...DEFAULTS},shanghai,SUMMER_DAY,'上海 / 同济','演示 / 近似数据');
  const files={'shanghai-summer':sh,'guangzhou-summer':gz,'guangzhou-winter':gzw,'shanghai-mock-summer':mock};
  for(const [name,pack] of Object.entries(files)){
    fs.writeFileSync(path.join(notes,name+'.svg'),pack.sheet);
    raster(pack.sheet,path.join(notes,name+'.png'));
    execFileSync('python3',['-c','import sys,xml.etree.ElementTree as ET;ET.fromstring(sys.stdin.read())'],{input:pack.sheet});
    const {dups}=ids(pack.sheet);ok(dups.length===0,name+' has unique XML ids');
    const y=[...pack.sheet.matchAll(/<text x="78" y="(\d+)"/g)].map(m=>Number(m[1]));
    const placed=[...pack.sheet.matchAll(/<svg x="78" y="(\d+)" width="964" height="650"/g)].map(m=>Number(m[1]));
    ok(placed[0]===190&&placed[0]+650<=881,name+' date diagram stays above the parameter heading');
    const paramYs=y.filter(v=>v>=916&&(placed[1]?v<placed[1]:true));
    ok(paramYs.length&&Math.max(...paramYs)+8< (placed[1]??Infinity),name+' parameter rows do not overlap the backend diagram');
    const rules=[...pack.sheet.matchAll(/<path d="M78 (\d+)H1042"/g)].map(m=>Number(m[1]));if(placed[1])ok(rules.length>=2&&placed[1]+650<=rules.at(-1),name+' backend diagram stays above the footer rule');
    ok(!/91\.1|91\.14974|44\.416552|44\.4(?!\d)/.test(pack.sheet)&&!/S级|is_gb_compliant|规范认证通过|GB达标/.test(pack.sheet),name+' does not present live scores or a compliance certificate');
    ok(pack.frame.solarTime==='12:00'&&pack.sheet.includes('真太阳时 12:00（非北京时间）')&&pack.sheet.includes(pack.frame.date),name+' states true solar noon and the locked date');
  }
  const gzText=texts(gz.sheet).join('\n');
  ok(gzText.includes('夏季遮阳率：0%')&&gzText.includes('适用性待校核：夏至正午南窗无正面入射，后端按约定返回遮挡率0')&&gzText.includes('不等于普通遮阳不足')&&gzText.includes('无夏至代表线'),'Guangzhou sheet annotates 0% shading and has no-summer-ray legend');
  ok(!texts(sh.sheet).join('\n').includes('适用性待校核')&&!texts(sh.sheet).join('\n').includes('无夏至代表线')&&texts(sh.sheet).join('\n').includes('冬夏设计工况对照 / 后端代表射线'),'Shanghai incidence case keeps the standard case title and has no inapplicable caveat');
  const backendKinds=[...gz.backendSvg.matchAll(/data-ray-kind="([^"]+)"/g)].map(m=>m[1]);
  const backendGroupHasSummerColor=gz.sheet.split('冬夏设计工况对照')[1]?.includes('夏至光线')===true;
  ok(gz.backendSvg.includes('data-ray-source="backend"')&&backendKinds.length===2&&gzText.includes('夏季：无正面入射')&&gzText.includes('夏至 89.7° / 北侧')&&!gz.backendSvg.includes('data-ray-source="frontend-date-geometry"'),'Guangzhou backend diagram keeps winter rays only and names no front incidence');
  ok(gz.dateSvg.includes('北侧太阳，南窗无正面入射')&&gz.dateSvg.includes('data-ray-source="frontend-date-geometry"')&&!(gz.dateSvg.match(/data-ray-kind="/)||[]).length,'Guangzhou 6/21 date diagram is frontend geometry with no representative ray');
  ok(Math.abs(guangzhou.metrics.winter_penetration_m-guangzhou.svg_rays.winter_hit_depth)<1e-12&&gzText.includes('冬至日入射深度：1.66 m')&&sh.sheet.includes('冬至日入射深度：2.35 m'),'Winter depth in the snapshot matches the backend result depth');
  ok(texts(mock.sheet).some(t=>t.includes('不是物理精度或 GB 50033 达标证明'))&&texts(sh.sheet).some(t=>t.includes('不含框厚/家具/真实GI，非施工图或规范认证')),'Footers disclaim certification and real GI');
  ok(texts(gz.sheet).every(t=>!t.includes('�')),'Chinese text has no replacement characters in the SVG source');
  for(const route of ['/src/export.ts','/src/App.tsx','/src/Section.tsx'])ok((await fetch('http://127.0.0.1:5174'+route)).status===200,'HTTP 200 '+route);
  console.log(n+' targeted export XML/guard/source checks passed; rasters are offline resvg+Noto, not a Chrome preview. No full suite or build.');
}finally{await server.close()}
