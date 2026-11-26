/** Bounded source+XML check for the 07:00 export closeout. SSR sheets are NOT page downloads. No raster, no full test suite, no production build. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const notes=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(notes,'../..');
const outDir=path.join(notes,'static-ssr');
fs.mkdirSync(outDir,{recursive:true});
const require=createRequire(path.join(root,'前端文件/package.json'));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom',logLevel:'error'});
let n=0;const lines=[];
const ok=(c,m)=>{assert.ok(c,m);n++;lines.push('PASS  '+m);console.log('PASS',m)};
function texts(svg){return [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'))}
function ids(svg){const all=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const dups=[...new Set(all.filter((id,i)=>all.indexOf(id)!==i))];return {all,dups}}
function units(s){let u=0;for(const ch of s)u+=/[\u0000-\u007f]/.test(ch)?.56:1;return u}
try{
  const {designSheet,currentExportResult}=await server.ssrLoadModule('/src/export.ts');
  const Section=(await server.ssrLoadModule('/src/Section.tsx')).default;
  const {annualSolarFrame,SUMMER_DAY,WINTER_DAY,dayFromDate}=await server.ssrLoadModule('/src/annual.ts');
  const {DEFAULTS}=await server.ssrLoadModule('/src/model.ts');
  const {FONT_STACK,INK}=await server.ssrLoadModule('/src/presentation.ts');
  const shanghai=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-shanghai.json'),'utf8'));
  const guangzhou=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-guangzhou.json'),'utf8'));
  const presets=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-presets.json'),'utf8'));
  const room=presets.room;
  const app=fs.readFileSync(path.join(root,'前端文件/src/App.tsx'),'utf8');
  const css=fs.readFileSync(path.join(root,'前端文件/src/styles.css'),'utf8');
  const exportSrc=fs.readFileSync(path.join(root,'前端文件/src/export.ts'),'utf8');

  ok(FONT_STACK==='Inter, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif','Export font stack matches the documented UI stack');
  ok(css.includes('font-family:"Inter","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'),'styles.css font-family lists the same families');
  ok(INK.text==='#26332f'&&INK.muted==='#55655c'&&INK.paper==='#f7f7f2'&&INK.line==='#d3d9d2'&&INK.forest==='#304c43'&&INK.summer==='#9b5037'&&INK.winter==='#80602a'&&INK.daylight==='#466556','INK tokens match CSS --ink/--muted/--paper/--line/--forest/--terra/--gold/--green');
  ok(currentExportResult(shanghai,false,false)===shanghai,'Valid current result is exportable');
  ok(currentExportResult(shanghai,true,false)===null&&currentExportResult(shanghai,false,'无法连接计算服务')===null&&currentExportResult(null,false,false)===null,'Pending, error or missing result is not treated as currently valid');
  ok(app.includes('flushSync(()=>timeline.pause())')&&app.includes('const current=currentExportResult(c.result,c.pending,c.hasError)')&&app.includes('disabled={!currentExportResult(result,pending,!!hasError)}')&&app.includes('if(c.room&&domDate!==c.frame.date)')&&app.includes("setToast(`SVG已导出 · ${locked.frame.date} 真太阳12:00 · 日期播放已暂停`)"),'Export pauses playback, locks a same-date snapshot, and disables the button when not current');
  ok(app.includes('useState({...DEFAULTS})')||app.includes('useState<Parameters>({...DEFAULTS})'),'Default parameters start from DEFAULTS');
  ok(app.includes('[heat,setHeat]=useState(false)')&&app.includes('timeline.jump(SUMMER_DAY)')&&app.includes("cameraView='analysis'"),'Default heat is off; reset jumps to summer solstice; camera is panorama-only');

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
  const shOther=sheetFor({...DEFAULTS},shanghai,dayFromDate('2026-09-23')??172,'上海 / 同济','后端计算 / 待专业校核');
  const mock=sheetFor({...DEFAULTS},shanghai,SUMMER_DAY,'上海 / 同济','演示 / 近似数据');
  const files={'shanghai-summer-ssr':sh,'guangzhou-summer-ssr':gz,'guangzhou-winter-ssr':gzw,'shanghai-0923-ssr':shOther,'shanghai-mock-summer-ssr':mock};
  for(const [name,pack] of Object.entries(files)){
    fs.writeFileSync(path.join(outDir,name+'.svg'),pack.sheet);
    execFileSync('python3',['-c','import sys,xml.etree.ElementTree as ET;ET.fromstring(sys.stdin.read())'],{input:pack.sheet});
    const {dups}=ids(pack.sheet);ok(dups.length===0,name+' has unique XML ids');
    const y=[...pack.sheet.matchAll(/<text x="78" y="(\d+(?:\.\d+)?)"/g)].map(m=>Number(m[1]));
    const placed=[...pack.sheet.matchAll(/<svg x="78" y="(\d+(?:\.\d+)?)" width="964" height="650"/g)].map(m=>Number(m[1]));
    ok(placed[0]===190&&placed[0]+650<=881,name+' date diagram stays above the parameter heading');
    const paramYs=y.filter(v=>v>=916&&(placed[1]?v<placed[1]:true));
    ok(paramYs.length&&Math.max(...paramYs)+8<(placed[1]??Infinity),name+' parameter rows do not overlap the backend diagram');
    const rules=[...pack.sheet.matchAll(/<path d="M78 (\d+(?:\.\d+)?)H1042"/g)].map(m=>Number(m[1]));
    if(placed[1])ok(rules.length>=2&&placed[1]+650<=rules.at(-1),name+' backend diagram stays above the footer rule');
    ok(!/91\.1|91\.14974|44\.416552|44\.4(?!\d)/.test(pack.sheet)&&!/S级|is_gb_compliant|规范认证通过|GB达标/.test(pack.sheet),name+' does not present live scores or a compliance certificate');
    ok(pack.frame.solarTime==='12:00'&&pack.sheet.includes('真太阳时 12:00（非北京时间）')&&pack.sheet.includes(pack.frame.date),name+' states true solar noon and the locked date');
    ok(pack.sheet.includes(`font-family="${FONT_STACK}"`)&&pack.sheet.includes(`fill="${INK.paper}"`)&&pack.sheet.includes('font-size="34"')&&pack.sheet.includes('font-size="21"')&&pack.sheet.includes('font-size="19"')&&pack.sheet.includes('font-size="17"'),name+' uses the shared font stack and the header/body/footer type scale');
    const longTexts=texts(pack.sheet).filter(t=>units(t)>46.01&&!t.includes('冬夏设计工况对照'));
    // case title is a 21px heading with a measured width budget; other 19px rows use wrapLabel 46
    ok(longTexts.length===0,name+' body rows stay within wrapLabel 46 units (no mid-row overflow in source)');
    ok(pack.dateSvg.includes('data-ray-source="frontend-date-geometry"')&&!pack.dateSvg.includes('data-result-depth')&&!pack.dateSvg.includes('data-ray-source="backend"'),name+' date diagram is frontend geometry without winter-depth dashes or backend rays');
  }
  const gzText=texts(gz.sheet).join('\n');
  const shText=texts(sh.sheet).join('\n');
  ok(gzText.includes('夏季遮阳率：0%')&&gzText.includes('适用性待校核：夏至正午南窗无正面入射，后端按约定返回遮挡率0')&&gzText.includes('不等于普通遮阳不足')&&gzText.includes('无夏至代表线'),'Guangzhou sheet annotates 0% shading and has no-summer-ray legend');
  ok(!shText.includes('适用性待校核')&&!shText.includes('无夏至代表线')&&shText.includes('冬夏设计工况对照 / 后端代表射线'),'Shanghai incidence case keeps the standard case title and has no inapplicable caveat');
  ok(gzText.includes('以下数值为后端冬夏设计工况，不是所选日期或全年评分')&&shText.includes('不是所选日期或全年评分')&&exportSrc.includes('日期图为前端几何，工况数据为后端'),'Sheet language keeps date vs backend-case source boundary (界面「日期不重计分」的等价表述)');
  ok(gz.backendSvg.includes('夏季：无正面入射')&&!gz.backendSvg.includes('data-ray-source="frontend-date-geometry"')&&gzText.includes('夏季：无正面入射'),'Guangzhou backend diagram names no front incidence');
  ok(gz.dateSvg.includes('北侧太阳，南窗无正面入射')&&gz.dateSvg.includes('data-ray-source="frontend-date-geometry"'),'Guangzhou 6/21 date diagram is north-side / no front incidence frontend geometry');
  ok(gzw.dateSvg.includes(gzw.frame.date)&&gzw.sheet.includes(gzw.frame.date)&&texts(gzw.sheet).join('\n').includes('冬至日入射深度：1.66 m')&&texts(gz.sheet).join('\n').includes('冬至日入射深度：1.66 m'),'Changing solstice date keeps backend winter depth and case metrics');
  ok(shOther.frame.date==='2026-09-23'&&shOther.dateSvg.includes('2026-09-23')&&shOther.sheet.includes('冬至日入射深度：2.35 m')&&!shOther.dateSvg.includes('data-result-depth'),'A non-solstice date updates the date diagram but not winter-depth / DF case figures');
  ok(Math.abs(guangzhou.metrics.winter_penetration_m-guangzhou.svg_rays.winter_hit_depth)<1e-12&&gzText.includes('冬至日入射深度：1.66 m')&&sh.sheet.includes('冬至日入射深度：2.35 m'),'Winter depth in the snapshot matches the backend result depth');
  ok(texts(mock.sheet).some(t=>t.includes('不是物理精度或 GB 50033 达标证明'))&&texts(sh.sheet).some(t=>t.includes('不含框厚/家具/真实GI，非施工图或规范认证')),'Footers disclaim certification and real GI');
  ok(texts(gz.sheet).every(t=>!t.includes('\uFFFD')),'Chinese text has no replacement characters in the SVG source');
  for(const route of ['/src/export.ts','/src/App.tsx','/src/Section.tsx'])ok((await fetch('http://127.0.0.1:5174'+route)).status===200,'HTTP 200 '+route);
  const readme=`# 静态 SSR 设计单（不是本轮页面下载）

这些 SVG 由当前源码 \`designSheet\` + \`Section\` 服务端渲染生成，并用 Python ElementTree 解析。它们不是浏览器「导出设计单」的真实下载，也不是 Chrome 预览或 02:53 旧样张。主线程须从 http://127.0.0.1:5174/ 在默认可导出状态下真实下载，另存到本目录以外或本目录下明确命名的 download/ 下，不要覆盖本文件，也不要把 /home/box/Downloads 里旧的 (10)/(11).svg 当成本轮证据。
`;
  fs.writeFileSync(path.join(outDir,'README.md'),readme);
  const summary=lines.join('\n')+`\n\nRESULT: PASS (${n} passed). SSR XML only; not a page download, not a Chrome preview, no raster.\n`;
  fs.writeFileSync(path.join(notes,'static-check.txt'),summary);
  console.log(n+' targeted export XML/guard/source checks passed; SSR XML is not a page download. No raster, full suite or build.');
}catch(e){
  fs.writeFileSync(path.join(notes,'static-check.txt'),lines.join('\n')+'\nFAIL  '+e+'\n');
  throw e;
}finally{await server.close()}
