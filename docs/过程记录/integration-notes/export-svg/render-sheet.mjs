import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {createRequire as cr} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const notes=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.join(root,'前端文件/package.json'));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {createServer}=await import(pathToFileURL(require.resolve('vite')));
const {Resvg}=await import('/workspace/suncraft-upload-20261125-2314/raster-tools/node_modules/@resvg/resvg-js/index.js');
const server=await createServer({root:path.join(root,'前端文件'),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},ssr:{optimizeDeps:{noDiscovery:true,include:[]}},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/*']}},appType:'custom',logLevel:'error'});
function ids(svg){const all=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const c=Object.create(null);for(const id of all)c[id]=(c[id]||0)+1;return {all,dups:Object.entries(c).filter(([,n])=>n>1)} }
function texts(svg){return [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'"))}
function raster(svg,out){
  const r=new Resvg(svg,{
    fitTo:{mode:'width',value:1120},
    font:{loadSystemFonts:true,fontFiles:[
      '/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ],defaultFontFamily:'Noto Sans CJK SC',defaultFontFiles:['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']},
    background:'#f7f7f2',
  });
  fs.writeFileSync(out,r.render().asPng());
  return r;
}
try{
  const {designSheet}=await server.ssrLoadModule('/src/export.ts');
  const Section=(await server.ssrLoadModule('/src/Section.tsx')).default;
  const {annualSolarFrame,SUMMER_DAY,WINTER_DAY}=await server.ssrLoadModule('/src/annual.ts');
  const {DEFAULTS}=await server.ssrLoadModule('/src/model.ts');
  const shanghai=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-shanghai.json'),'utf8'));
  const guangzhou=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-guangzhou.json'),'utf8'));
  const presets=JSON.parse(fs.readFileSync(path.join(notes,'../analysis-audit/real-presets.json'),'utf8'));
  const room=presets.room;
  const cases=[
    {name:'shanghai-summer',city:'上海 / 同济',p:{...DEFAULTS},result:shanghai,day:SUMMER_DAY,mode:'后端计算 / 待专业校核'},
    {name:'shanghai-winter',city:'上海 / 同济',p:{...DEFAULTS},result:shanghai,day:WINTER_DAY,mode:'后端计算 / 待专业校核'},
    {name:'guangzhou-summer',city:'广州',p:{...DEFAULTS,city_id:'guangzhou',latitude:23.1},result:guangzhou,day:SUMMER_DAY,mode:'后端计算 / 待专业校核'},
    {name:'guangzhou-winter',city:'广州',p:{...DEFAULTS,city_id:'guangzhou',latitude:23.1},result:guangzhou,day:WINTER_DAY,mode:'后端计算 / 待专业校核'},
    {name:'shanghai-mock-summer',city:'上海 / 同济',p:{...DEFAULTS},result:shanghai,day:SUMMER_DAY,mode:'演示 / 近似数据'},
  ];
  const report=[];
  for(const c of cases){
    const frame=annualSolarFrame(c.day,c.p.latitude);
    const tree=React.createElement(React.Fragment,null,
      React.createElement(Section,{drawingId:'date-section-drawing',previewFrame:frame,room,parameters:c.p,result:null,season:frame.declination>=0?'summer':'winter'}),
      React.createElement(Section,{drawingId:'section-drawing',room,parameters:c.p,result:c.result,season:frame.declination>=0?'summer':'winter'}),
    );
    const markup=renderToStaticMarkup(tree);
    const svgs=markup.match(/<svg[\s\S]*?<\/svg>/g)||[];
    if(svgs.length!==2)throw new Error(c.name+' expected 2 svgs, got '+svgs.length);
    const sheet=designSheet(c.p,c.result,svgs[0],c.city,c.mode,presets.daylight_threshold_pct,room,frame,svgs[1]);
    const svgPath=path.join(notes,c.name+'.svg');
    fs.writeFileSync(svgPath,sheet);
    let pngErr='';
    try{raster(sheet,path.join(notes,c.name+'.png'))}catch(e){pngErr=String(e)}
    const t=texts(sheet);
    const id=ids(sheet);
    report.push({
      name:c.name,date:frame.date,solarTime:frame.solarTime,altitude:frame.altitude,south:frame.south,
      height:[...sheet.match(/height="(\d+)"/)][1],idDups:id.dups,texts:t,
      has91: /91\.1|91\.14974/.test(sheet), hasGradeS: /S级/.test(sheet) || />S</.test(sheet),
      hasGbFlag: /is_gb_compliant|GB达标|已达标|规范认证通过/.test(sheet),
      disclaimer: t.filter(x=>/规范认证|真实GI|达标证明/.test(x)),
      summerIncident:c.result.svg_rays.summer_incident, summerRays:c.result.svg_rays.summer?.length||0,
      winterDepthMetric:c.result.metrics.winter_penetration_m, winterDepthRay:c.result.svg_rays.winter_hit_depth,
      applicability:/适用性待校核|无夏至代表线|无正面入射/.test(sheet),
      noSummerLegend:t.filter(x=>/夏至|夏季|无正面|代表线/.test(x)),
      partitions:t.filter(x=>/日期几何|冬夏设计工况对照|真太阳/.test(x)),
      pngErr,
    });
  }
  fs.writeFileSync(path.join(notes,'pre-fix-audit.json'),JSON.stringify(report,null,2));
  for(const r of report){
    console.log('\n==',r.name,r.date,'solar',r.solarTime,'south',r.south,'h',r.height,'dups',r.idDups.length,'png',r.pngErr||'ok');
    console.log('91/S/GB',r.has91,r.hasGradeS,r.hasGbFlag,'applicabilityMatch',r.applicability,'depthEqual',r.winterDepthMetric===r.winterDepthRay);
    console.log('disclaimer',r.disclaimer);
    console.log('summer-labels',r.noSummerLegend);
    console.log('partitions',r.partitions);
  }
}finally{await server.close()}
