import {flushSync} from 'react-dom';
import {HEATMAP_GRADIENT} from './heatmap';
import {caseRayLegend} from './analysisCopy';
import AnnualTimeline,{useAnnualTimeline,solsticeDay} from './AnnualTimeline';
import {annualSolarFrame,termAt,SUMMER_DAY,WINTER_DAY} from './annual';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Sun, Snowflake, Layers3, RotateCcw, ArrowUpRight, MapPin, ChevronDown, SlidersHorizontal, Download, Sparkles, Move, Maximize, Settings2, X, TriangleAlert, Check, Leaf, LoaderCircle } from 'lucide-react';
import {ScoreCapsule,ScoreDrawer} from './scoring/ScoreDrawer';
import type {ReportView} from './scoring/ScoreDrawer';
import {EXAMPLE_SCORE_REPORT} from './scoring/example';
import type {LinkTarget} from './scoring/report';
import Scene from './Scene';import Section from './Section';import { api, initialConfig } from './api';import type {TransportConfig} from './api';
import { DEFAULTS, LIMITS, PRESETS, percent } from './model';import type {Parameters, Presets, Season, Optimization} from './model';
import { useSimulation } from './useSimulation';import { currentExportResult, designSheet, downloadSvg } from './export';
type SliderKey=keyof typeof LIMITS;
export default function App(){
 const [parameters,setParameters]=useState<Parameters>({...DEFAULTS}),[heat,setHeat]=useState(false),[resetToken,setResetToken]=useState(0),[ready,setReady]=useState(false);
 const [geometrySource,setGeometrySource]=useState('');
 const [config,setConfig]=useState<TransportConfig>(initialConfig),[presets,setPresets]=useState<Presets>(PRESETS),[presetsReady,setPresetsReady]=useState(false),[presetError,setPresetError]=useState('');
 const [busy,setBusy]=useState(false),[optError,setOptError]=useState(''),[comparison,setComparison]=useState<Optimization|null>(null),[retry,setRetry]=useState(0),[toast,setToast]=useState(''),[settings,setSettings]=useState(false),[tab,setTab]=useState<'parameters'|'diagnostics'>('parameters');
 const timeline=useAnnualTimeline();const frame=useMemo(()=>annualSolarFrame(timeline.day,parameters.latitude),[timeline.day,parameters.latitude]);const season:Season=frame.declination>=0?'summer':'winter';const [reportView,setReportView]=useState<ReportView>('score'),[reportFocusRequest,setReportFocusRequest]=useState(0);const diagramView=reportView!=='score';
 const cameraView='analysis' as const;
 const [scoreOpen,setScoreOpen]=useState(false),[highlight,setHighlight]=useState<LinkTarget|null>(null);
 const scoreButton=useRef<HTMLButtonElement>(null);
 const closeScore=useCallback(()=>{setScoreOpen(false);setHighlight(null);setTab('parameters');requestAnimationFrame(()=>scoreButton.current?.focus())},[]);
 function toggleScore(){const open=!scoreOpen;if(open)setReportView('score');setScoreOpen(open);setTab(open?'diagnostics':'parameters')}
 const [draftConfig,setDraftConfig]=useState(config),[configError,setConfigError]=useState('');
 const optimizeController=useRef<AbortController|null>(null),tween=useRef<gsap.core.Tween|null>(null),operation=useRef(0);
 const {result,pending,error}=useSimulation(parameters,config,busy||!presetsReady,retry);
 const room=presetsReady&&geometrySource===JSON.stringify(config)?presets.room??null:null;
 const scoreReport=config.mode==='mock'?EXAMPLE_SCORE_REPORT:result?.score_report??null;

 useEffect(()=>{setPresetsReady(false);setPresetError('');const ctrl=new AbortController();api.presets(config,ctrl.signal).then(data=>{if(!ctrl.signal.aborted){setPresets(data);setGeometrySource(JSON.stringify(config));setParameters(p=>{const city=data.cities.find(c=>c.id===p.city_id)??data.cities[0];return {...p,city_id:city.id,latitude:city.latitude}});setPresetsReady(true)}}).catch(e=>{if(!ctrl.signal.aborted)setPresetError(e.message||'预设请求失败')});return()=>ctrl.abort()},[config,retry]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id)},[toast]);
 useEffect(()=>()=>{operation.current++;optimizeController.current?.abort();tween.current?.kill()},[]);
 useEffect(()=>{if(!settings)return;const previous=document.activeElement as HTMLElement|null;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSettings(false);return}if(e.key!=='Tab')return;const elements=Array.from(document.querySelectorAll<HTMLElement>('.settings-modal button,.settings-modal select,.settings-modal input'));const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus()}},[settings]);
 function cancelOptimize(){operation.current++;optimizeController.current?.abort();tween.current?.kill();setBusy(false)}
 function cancelAndSnap(){cancelOptimize();setParameters(p=>({...p,overhang_depth_m:Math.round(p.overhang_depth_m/.05)*.05,louver_angle_deg:Math.round(p.louver_angle_deg)}));setComparison(null)}
 function change(key:SliderKey,value:number){cancelOptimize();setParameters(p=>({...p,[key]:value}));setComparison(null);setOptError('')}
 async function optimize(){cancelOptimize();const op=++operation.current,ctrl=new AbortController();optimizeController.current=ctrl;setBusy(true);setOptError('');setComparison(null);
 try{const answer=await api.optimize(parameters,config,ctrl.signal);if(ctrl.signal.aborted||op!==operation.current)return;
 const animated={...parameters};const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 tween.current=gsap.to(animated,{overhang_depth_m:answer.parameters.overhang_depth_m,louver_angle_deg:answer.parameters.louver_angle_deg,duration:reduced?0:1.1,ease:'power2.inOut',onUpdate:()=>{if(op===operation.current)setParameters({...parameters,overhang_depth_m:animated.overhang_depth_m,louver_angle_deg:animated.louver_angle_deg})},onComplete:()=>{if(op!==operation.current)return;setParameters({...answer.parameters});setComparison(answer);setBusy(false);setToast(config.mode==='mock'?'演示寻优完成 · 当前窗墙比保持不变':'寻优参数已应用 · 等待模拟复核')}})
 }catch(e){if(!ctrl.signal.aborted&&op===operation.current){setOptError(e instanceof Error?e.message:'寻优失败');setBusy(false)}}}
 const summerContribution=result?.score_report?.dimensions.flatMap(d=>d.items).find(item=>item.key==='summer_shading_rate');
 const city=presets.cities.find(c=>c.id===parameters.city_id),hasError=error||presetError||optError;
 const currentResult=pending||hasError?null:result,m=currentResult?.metrics,heatReady=!!room&&!!currentResult,rayLegend=caseRayLegend(currentResult);
 const exportContext=useRef({parameters,result,pending,hasError,cityName:city?.name??parameters.city_id,mode:config.mode,threshold:presets.daylight_threshold_pct,room,frame});
 useLayoutEffect(()=>{exportContext.current={parameters,result,pending,hasError,cityName:city?.name??parameters.city_id,mode:config.mode,threshold:presets.daylight_threshold_pct,room,frame}});
 const [exportDate,setExportDate]=useState('');
 function reset(){cancelOptimize();setParameters({...DEFAULTS,city_id:parameters.city_id,latitude:parameters.latitude});timeline.jump(SUMMER_DAY);setHeat(false);setComparison(null);setOptError('');setResetToken(t=>t+1)}
 // Stop the actual RAF clock before committing pending React updates. Focus/pointer-down
 // also pause early so export remains reachable during continuous scene redraws.
 function exportSheet(){flushSync(()=>timeline.pause());const c=exportContext.current;
 const current=currentExportResult(c.result,c.pending,c.hasError);if(!current){setToast('模拟结果尚未就绪，暂停后请等待计算完成再导出');return}
 try{const svg=document.getElementById('date-section-drawing');if(!svg)throw Error('日期剖面未就绪');
 const domDate=svg.querySelector('[data-solar-date]')?.getAttribute('data-solar-date');if(c.room&&domDate!==c.frame.date)throw Error('日期图与快照未同步，请重试');
 const snapshot=svg.cloneNode(true) as SVGSVGElement;snapshot.querySelectorAll('[data-analysis-annotation]').forEach(node=>node.remove());
 const backend=document.getElementById('section-drawing')?.cloneNode(true) as SVGSVGElement|undefined;backend?.querySelectorAll('[data-analysis-annotation]').forEach(node=>node.remove());
 const xml=new XMLSerializer(),locked={parameters:{...c.parameters},frame:{...c.frame,direction:{...c.frame.direction}},result:current,dateSvg:xml.serializeToString(snapshot),backendSvg:backend?xml.serializeToString(backend):undefined};
 downloadSvg(designSheet(locked.parameters,locked.result,locked.dateSvg,c.cityName,c.mode==='mock'?'演示 / 近似数据':'后端计算 / 待专业校核',c.threshold,c.room,locked.frame,locked.backendSvg));
 setExportDate(locked.frame.date);setToast(`SVG已导出 · ${locked.frame.date} 真太阳12:00 · 日期播放已暂停`)
 }catch(e){setToast(`导出未完成：${e instanceof Error?e.message:'请重试'}`)}}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setToast('浏览器不允许全屏，可使用 F11 放大工作台')}}
 function applySettings(){setConfigError('');try{const url=new URL(draftConfig.baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();cancelOptimize();setConfig({...draftConfig,baseUrl:url.toString().replace(/\/$/,'')});setComparison(null);setSettings(false)}catch{setConfigError('请输入不含账号密码的 HTTP(S) 后端地址')}}
 return <main className={`workspace season-${season}${scoreOpen?' score-report-open':''}${scoreOpen&&diagramView?' date-preview-active':''}`}>
 <Scene solarFrame={frame} room={room} highlight={highlight} cameraView={cameraView} parameters={parameters} season={season} heat={heat} result={result} resultCurrent={!!currentResult} resetToken={resetToken} onReady={()=>setReady(true)}/>
 <div className="scene-vignette"/>
 <header className="brand"><div className="brand-icon"><Sun size={25} strokeWidth={1.3}/></div><div><h1>SunCraft<span>夏遮冬透</span></h1></div></header>
 <div className="top-controls glass"><div className="season-tabs" role="group" aria-label="季节切换" onPointerDownCapture={timeline.pause}><button aria-pressed={timeline.day===SUMMER_DAY} className={timeline.day===SUMMER_DAY?'active':''} onClick={()=>timeline.jump(solsticeDay('summer'))}><Sun size={16}/>夏至正午</button><button aria-pressed={timeline.day===WINTER_DAY} className={timeline.day===WINTER_DAY?'active':''} onClick={()=>timeline.jump(solsticeDay('winter'))}><Snowflake size={16}/>冬至正午</button></div><span className="control-divider"/><button className={`heat-toggle ${heat?'on':''}`} aria-label="采光热力" aria-pressed={heat} onClick={()=>setHeat(v=>!v)}><Layers3 size={16}/><span className="heat-label-full">采光热力</span><span className="heat-label-short" aria-hidden="true">热力</span><span className="switch"><i/></span></button></div>
 <div className="top-right"><button className="icon-button glass" title="连接设置" aria-label="连接设置" onClick={()=>{setDraftConfig(config);setConfigError('');setSettings(true)}}><Settings2 size={17}/></button><button className="export-button" data-export-date={exportDate||undefined} title="导出当前日期设计单（聚焦或按下时暂停日期播放）" onPointerDownCapture={timeline.pause} onFocusCapture={timeline.pause} onKeyDownCapture={e=>{if(e.key==='Enter'||e.key===' ')timeline.pause()}} aria-label="导出设计单" disabled={!currentExportResult(result,pending,!!hasError)} onClick={exportSheet}><Download size={16}/><span className="export-label-full">导出设计单</span><span className="export-label-short" aria-hidden="true">导出</span><ArrowUpRight size={14}/></button></div>
 <nav className="mobile-tabs glass" aria-label="工作面板"><button className={tab==='parameters'?'active':''} onClick={()=>{setTab('parameters');setScoreOpen(false);setHighlight(null)}}>设计参数</button><button className={tab==='diagnostics'?'active':''} onClick={()=>{setTab('diagnostics');setScoreOpen(true)}}>评分与剖面</button></nav>
 <aside className={`left-panel panel glass ${tab==='parameters'?'mobile-visible':''}`} aria-label="设计参数">
 <div className="panel-heading"><div><h2>建筑表皮</h2></div><SlidersHorizontal size={19}/></div>
 <label className="field-label" htmlFor="city">项目地点</label><div className="select-wrap"><MapPin size={16}/><select id="city" disabled={busy||!presetsReady} value={parameters.city_id} onChange={e=>{const c=presets.cities.find(v=>v.id===e.target.value)!;setParameters(p=>({...p,city_id:c.id,latitude:c.latitude}));setComparison(null);setOptError('')}}>{presets.cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={14}/></div>
 <div className="location-meta"><span>{parameters.latitude.toFixed(1)}° N</span><span>正南朝向 · 12:00 太阳时</span></div>
 
 <fieldset className="sliders" disabled={busy}>
 {([{key:'overhang_depth_m',name:'挑檐深度',en:'OVERHANG',unit:'m',number:parameters.overhang_depth_m.toFixed(2),desc:'窗外水平遮阳的构件进深',ends:['0.00 m','1.80 m']},{key:'louver_angle_deg',name:'水平百叶倾角',en:'LOUVER ANGLE',unit:'°',number:parameters.louver_angle_deg.toFixed(0),desc:'正角外缘向下；0° 水平仍遮光',ends:['0° 水平','80° 倾斜']},{key:'window_wall_ratio',name:'窗墙比',en:'WINDOW-TO-WALL',unit:'%',number:Math.round(parameters.window_wall_ratio*100).toString(),desc:'固定窗宽，仅改变窗洞高度',ends:['25%','65%']} ] as {key:SliderKey;name:string;en:string;unit:string;number:string;desc:string;ends:string[]}[]).map(s=>{const l=LIMITS[s.key];return <div className="slider-field" key={s.key}><div className="slider-title"><label htmlFor={s.key}>{s.name}</label><output htmlFor={s.key}>{s.number}<small>{s.unit}</small></output></div><input id={s.key} type="range" min={l.min} max={l.max} step={l.step} value={parameters[s.key]} style={{'--progress':`${(parameters[s.key]-l.min)/(l.max-l.min)*100}%`} as React.CSSProperties} onChange={e=>change(s.key,Number(e.target.value))} aria-valuetext={`${s.number} ${s.unit}`}/><div className="range-ends"><span>{s.ends[0]}</span><span>{s.ends[1]}</span></div><p className="field-hint">{s.desc}</p></div>})}
 </fieldset>
 <div className="optimize-area"><button className="optimize-button" onClick={optimize} disabled={busy||!presetsReady||pending||!!error}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{busy?'寻找光与热的平衡…':'一键寻优'}<small>{config.mode==='mock'?'演示网格搜索':'总分寻优 · 后端计算'}</small></span><ArrowUpRight size={17}/></button>{busy?<button className="text-button cancel" onClick={cancelAndSnap}>取消寻优</button>:<p className="optimize-note">固定窗墙比与冬夏设计工况，优化挑檐与百叶；不按当前日期计分。{config.mode==='mock'&&'演示评分，非真实帕累托解。'}</p>}</div>
 <details className="annual-method"><summary>日期预览方法与边界</summary><p>仅2026，真太阳时12:00，不是北京时间。NOAA/Meeus赤纬取当日UTC12代表值，逐日期计算，不在冬夏间插值；无折射/天气，未标定实测误差。</p><p>节气日期：香港天文台2026年历（UTC+8）。DF为固定几何的均匀天空值；评分/寻优按冬夏设计工况，日期播放不改变它们。</p><p>系统减少动态时不自动播放；可手动播放，切出页面自动暂停。</p></details>
 <button className="reset-button" type="button" onClick={reset} title="暂停播放并回到夏至，参数恢复默认，全景复位；保留当前城市" aria-label="重置参数与视角：暂停播放并回到夏至，参数恢复默认，全景复位，保留当前城市"><RotateCcw size={13}/>重置参数与视角</button>
 </aside>
 <div className="scene-caption" aria-label={room?`固定南向客厅，${room.width_m} × ${room.depth_m} × ${room.height_m} 米`:'南向客厅，几何未同步'}><div className="scene-title"><h2>南向客厅</h2><p><span>分析全景</span><span className="view-size">{room?`${room.width_m}×${room.depth_m}×${room.height_m} m`:'几何未同步'}</span></p></div><div className="study-meta"><strong>{frame.date.slice(5).replace('-','.')} · {termAt(timeline.day).label}</strong><span>12:00 太阳时</span></div></div>
 <AnnualTimeline state={timeline} frame={frame} onSection={()=>{setReportView('date');setReportFocusRequest(n=>n+1);setScoreOpen(true);setTab('diagnostics')}}/>
 <ScoreCapsule report={hasError?null:scoreReport} open={scoreOpen} pending={pending} error={hasError||result?.score_report_error} suppressed={scoreOpen&&diagramView} onToggle={toggleScore} buttonRef={scoreButton}/>
 <ScoreDrawer view={reportView} onViewChange={setReportView} focusRequest={reportFocusRequest} open={scoreOpen} report={scoreReport} pending={pending} failed={!!hasError} scopeKey={JSON.stringify(parameters)} error={result?.score_report_error} preview={<div className="annual-section"><Section drawingId="date-section-drawing" previewFrame={frame} room={room} parameters={parameters} result={null} season={season}/><p>真太阳12:00（非北京时间）· NOAA日级几何，与3D同源；非真实GI，也不计算当天分数/DF。</p></div>}
 applicability={config.mode==='api'&&currentResult?.svg_rays.summer_incident===false?<p className="annual-applicability" role="note">适用性待校核：夏至正午南窗无正面入射，后端按约定返回遮挡率0，原报告遮阳项贡献{summerContribution?.score??'—'}/{summerContribution?.max_score??'—'}；本页保留原总分与贡献。这不等于普通遮阳不足，也不是所选日期或全年性能。</p>:undefined}
 simulationNotice={hasError&&<div className="error-box" role="alert"><TriangleAlert size={15}/><span>{hasError}<button onClick={()=>{setOptError('');setRetry(r=>r+1)}}>重新请求</button></span></div>} onClose={closeScore} onHighlight={setHighlight} onOptimize={optimize} onCancel={cancelAndSnap} busy={busy} canOptimize={presetsReady&&!pending&&!error} renderDepthPreview={drawingId=><><p className="linked-depth-caption">当前冬季结果标注：<strong>{pending?'更新中':currentResult?`${currentResult.svg_rays.winter_hit_depth.toFixed(2)} m`:'待可用结果'}</strong><span>模拟剖面定位，非评分示例值</span></p><Section room={room} drawingId={drawingId} highlightWinter={highlight==='winter-depth'} parameters={parameters} result={currentResult} season={season}/></>}>
 <div className={`data-notice ${config.mode==='api'?'api-mode':''}`}><span className="notice-dot"/>{config.mode==='mock'?'演示 / 近似数据 · 非规范判定':room?'后端计算 / 理想几何已同步 · 非精度认证':'后端计算 / 几何未同步 · 暂停3D'}</div>
 
 <section className="section-card"><div className="section-card-title"><h3>冬夏工况剖面对照</h3><span>A — A</span></div><Section room={room} highlightWinter={highlight==='winter-depth'} parameters={parameters} result={currentResult} season={season}/><div className="drawing-legend">{!rayLegend.ready&&<span>工况图例待可用结果</span>}{rayLegend.ready&&rayLegend.summer&&<span><i className="summer-line"/>夏至光线</span>}{rayLegend.ready&&rayLegend.noSummerIncident&&<span>夏季无正面入射，无夏至代表线</span>}{rayLegend.ready&&rayLegend.winter&&<span><i className="winter-line"/>冬至光线</span>}<span>几何示意 · 非施工图</span></div></section>
 <div className="depth-row"><span>冬至日入射深度</span><strong>{m?m.winter_penetration_m.toFixed(2):'—'}<small> m</small></strong></div>
 <div className="metrics" aria-busy={pending}>
 <Metric name="夏季遮阳率" tag="直射遮挡" value={m?.summer_shading_rate} color="terra" icon={<Sun size={15}/>} hint={currentResult?.svg_rays.summer_incident===false?'无正面入射 · 原评分待校核':m&&m.summer_shading_rate<.65?'夏季遮阳率偏低':m?'夏季遮阳改善':'等待计算'} />
 <Metric name="冬季得热率" tag="冬季得热" value={m?.winter_solar_gain_rate} color="gold" icon={<Snowflake size={15}/>} hint="保留冬日温暖" />
 <Metric name="采光面积比例" tag={`DF ≥ ${presets.daylight_threshold_pct.toFixed(1)}%`} value={m?.daylight_compliance_rate} color="green" icon={<Leaf size={15}/>} hint={m?(m.daylight_compliance_rate>=.8?'面积比例 ≥ 80%（待复核）':'面积比例低于 80% 目标'):'等待计算'} />
 </div>
 {comparison&&<div className="comparison"><Check size={14}/><span>{config.mode==='mock'?'演示寻优已应用':'寻优参数已应用'} · 遮阳率 {percent(comparison.before.metrics.summer_shading_rate)} → {percent(comparison.after.metrics.summer_shading_rate)}</span></div>}
 <p className="model-footnote">{hasError?'当前结果不可用，指标与热力不以上次成功为准。':pending?'参数已即时预览，指标与热力图待更新。':config.mode==='mock'?`${result?.heatmap_grid.length??'—'} × ${result?.heatmap_grid[0]?.length??'—'} 演示矩阵，与 3D 阴影独立；非 GB 50033 判定。0° 水平百叶夏至仍可能全遮直射。`:`${result?.heatmap_grid.length??'—'} × ${result?.heatmap_grid[0]?.length??'—'} DF百分数矩阵；固定均匀天空，与日期无关。热力为地面投影，0–5%固定色标（≥5%封顶），平滑仅显示，不新增采样；数值/虚线来自接口，${room?'理想几何已同步；型材/家具/反射为展示近似，统计区不等于实体沙发。':'几何未同步，3D/剖面暂停。'}`}</p>
 
 </ScoreDrawer>
 <div className="viewport-tools glass" role="group" aria-label="全景相机"><button aria-label="复位全景相机" title="按当前画布完整取景（含1.8m挑檐）；手动旋转后窗口变化不强制复位" onClick={()=>setResetToken(t=>t+1)}><RotateCcw size={15}/><span>复位</span></button><span/><button aria-label="全屏显示" title="全屏显示" onClick={fullscreen}><Maximize size={16}/></button></div>
 {highlight==='sofa'&&<div className="analysis-hint" role="status">{room?`后端假定占地 · 宽${room.sofa_width_m}m／距窗${room.sofa_depth_range_m.join('–')}m，非实体沙发受光结论`:'统计区域几何未同步'}</div>}
 {heat&&<div className="heat-legend glass" aria-label="固定绝对色标的DF百分数，非当前日期光照"><div><strong>均匀天空 DF</strong><span>% · {config.mode==='mock'?'演示':'接口'}</span></div>{heatReady?<><i style={{background:HEATMAP_GRADIENT}}/><div><span>0</span><span>2.5</span><span>5.0+</span></div><p>固定色标 · 与日期无关</p></>:<p role="status">{!room?'几何未同步，热力暂停':hasError?'热力图不可用':pending?'热力图待更新':'暂无当前热力数据'}</p>}</div>}
 <footer className="statusbar"><div><span className={`status-dot ${ready?'ready':''}`}/><span>{room?(ready?'3D 场景就绪':'正在构建空间…'):'几何未同步'}</span><b>·</b><span>{config.mode==='mock'?'演示模式':'API · 理想几何'}</span></div><p><Move size={12}/>拖动旋转 · 滚轮缩放</p></footer>
 {hasError&&!scoreOpen&&<button className="collapsed-error" onClick={()=>{setScoreOpen(true);setTab('diagnostics')}}><TriangleAlert size={15}/>模拟出现错误 · 打开细则重试</button>}
 {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
 {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className="settings-modal glass" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setSettings(false)}}><button className="modal-close icon-button" aria-label="关闭设置" onClick={()=>setSettings(false)}><X size={19}/></button><h2 id="settings-title">计算服务连接</h2><p>HTTP源码入口默认连接真实API；文件离线版保留演示。接口失败不会伪装为演示成功。</p><label htmlFor="data-mode">数据模式</label><select id="data-mode" value={draftConfig.mode} onChange={e=>setDraftConfig(c=>({...c,mode:e.target.value as 'mock'|'api'}))}><option value="mock">演示 / 近似数据</option><option value="api">FastAPI 后端</option></select><label htmlFor="base-url">后端地址（不含 /api）</label><input id="base-url" autoFocus type="url" value={draftConfig.baseUrl} onChange={e=>setDraftConfig(c=>({...c,baseUrl:e.target.value}))}/><p className="settings-help">需要允许当前页面来源的 CORS。契约见项目 README。此设置仅本次会话有效。</p>{configError&&<p role="alert" className="settings-error">{configError}</p>}<button className="optimize-button" onClick={applySettings}>应用连接设置<ArrowUpRight size={16}/></button></section></div>}
 </main>
}
function Metric({name,tag,value,color,icon,hint}:{name:string;tag:string;value:number|undefined;color:string;icon:React.ReactNode;hint:string}){return <div className={`metric ${color}`}><div className="metric-top"><span>{icon}{name}</span><strong>{value===undefined?'—':Math.round(value*100)}<small>%</small></strong></div><div className="metric-bottom"><span>{tag}</span><span>{hint}</span></div></div>}
