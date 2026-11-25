import {useEffect,useReducer,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ChevronDown,TriangleAlert,X} from 'lucide-react';
import type {ScoreReport,LinkTarget} from './report';
import {formatScore,gradeColor} from './report';
import {ScoreRing} from './ScoreRing';
import {DimensionAccordion} from './DimensionAccordion';
import {EMPTY_SPATIAL,spatialReducer,spatialTarget} from './spatial';
export function ScoreCapsule({report,open,pending,error,onToggle,buttonRef}:{report:ScoreReport|null;open:boolean;pending:boolean;error?:string;onToggle:()=>void;buttonRef:React.RefObject<HTMLButtonElement|null>}){
 const example=report?.provenance==='example';
 return <button ref={buttonRef} className="score-capsule" type="button" onClick={onToggle} aria-expanded={open} aria-controls="score-drawer" aria-label={`${example?'独立示例，非当前方案评分':pending?'评分待更新':'方案评分'} ${formatScore(report?.total_score)}，${report?.grade_label??'待后端评分数据'}，${open?'收起':'展开'}细则`}><div className="capsule-score"><ScoreRing value={report?.total_score??null} max={report?.max_score??100} grade={report?.grade??''}/></div><span className="capsule-copy"><strong style={{borderColor:report?gradeColor(report.grade):undefined}}>{error?'异常':example?`示例 · ${report?.grade}级`:report?.grade?`${report.grade}级`:'待接入'}</strong><small>{error?'评分不可用':example?'非当前方案':pending?(report?'更新中 · 上次评分':'评分请求中'):report?.grade_label??'后端尚未提供评分'}</small></span><span className="capsule-detail">{(report?.warnings.length??0)>0&&<TriangleAlert size={13} aria-label="含报告警示"/>}细则<ChevronDown size={13}/></span></button>;
}
export function ScoreDrawer({open,report,pending,error,simulationNotice,onClose,onHighlight,onOptimize,onCancel,busy,canOptimize,children,renderDepthPreview}:{open:boolean;report:ScoreReport|null;pending:boolean;error?:string;simulationNotice?:ReactNode;onClose:()=>void;onHighlight:(target:LinkTarget|null)=>void;onOptimize:()=>void;onCancel:()=>void;busy:boolean;canOptimize:boolean;children:ReactNode;renderDepthPreview?:(drawingId:string)=>ReactNode}){
 const [openId,setOpenId]=useState<string|null>(null),[diagnostics,setDiagnostics]=useState(false),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;close.current?.focus();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('[aria-modal="true"]')){event.stopPropagation();onClose()}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[open,onClose]);
 // Separate pointer/focus ownership prevents scrolling or preview reflow from cancelling a focused row.
 const [spatial,dispatchSpatial]=useReducer(spatialReducer,EMPTY_SPATIAL);
 const target=spatialTarget(spatial);
 useEffect(()=>{dispatchSpatial({type:'clear'})},[open,openId,report]);
 useEffect(()=>{onHighlight(open?target:null)},[open,target,onHighlight]);
 const previewDimension=report?.dimensions.find(d=>d.id===openId&&d.items.some(item=>item.link_target==='winter-depth'));
 const example=report?.provenance==='example';
 return <section id="score-drawer" className={`score-drawer ${open?'is-open':''}`} role="region" aria-labelledby="score-drawer-title" aria-hidden={!open} inert={!open}><header className="score-drawer-heading"><div><h2 id="score-drawer-title">光热舒适评测</h2><p>{example?'独立示例 · 非当前方案评分':report?'后端评分 · 待专业校核':'旧版接口可用 · 评分待接入'}</p></div><button ref={close} className="icon-button" aria-label="关闭评分细则" onClick={onClose}><X size={18}/></button></header><div className="score-drawer-body">
 {simulationNotice}
 {error&&<p role="alert" className="score-report-error">评分暂不可用：{error}。原模拟指标与剖面仍可使用。</p>}
 {report?<><p className="score-provenance">{example?'以下为固定界面示例，不随参数或寻优变化；真实模拟指标在下方另列。':pending?'参数已变化，以下为上次返回的评分，等待更新。':'以下报告值与来源由接口提供，前端不重新计分，也不作规范认证。'}</p>{report.completeness==='partial'&&<p className="score-partial">报告不完整：仅展示后端已返回的维度/子项，不补造其余结果。</p>}
 <div className="dimension-overview" aria-label="各维度得分总览">{report.dimensions.map(d=><button key={d.id} onClick={()=>setOpenId(id=>id===d.id?null:d.id)} aria-label={`${d.name} ${formatScore(d.score)}/${d.weight}，展开子项`}><span><span>{d.name}</span><b>{formatScore(d.score)} / {d.weight}</b></span><i><i style={{width:`${d.weight?Math.min(100,(d.score??0)/d.weight*100):0}%`,background:gradeColor(report.grade)}}/></i></button>)}</div>
 {report.warnings.length>0&&<details className="score-warnings"><summary><TriangleAlert size={14}/>口径与警示（{report.warnings.length}）</summary><ul>{report.warnings.map(w=><li key={w.id}>{w.message}</li>)}</ul><p>警示单列，不擅自清零；来源分类不等于合规认定。</p></details>}
 <div className="score-dimensions">{report.dimensions.map(d=><DimensionAccordion key={d.id} dimension={d} open={openId===d.id} onToggle={()=>setOpenId(id=>id===d.id?null:d.id)} onSpatialAction={dispatchSpatial} depthPreview={d.items.some(item=>item.link_target==='winter-depth')?renderDepthPreview?.(`score-linked-mobile-${d.id}`):undefined}/>)}</div><div className="score-method"><strong>{example?'示例口径':'后端方法声明 · 前端未验证'}</strong><p>{report.methodology_note||'后端尚未提供方法声明。'}</p><p>精度、法规适用与S级可达性需独立验证。</p></div></>:<p className="score-provenance">当前模拟接口未提供 score_report。保留原有指标、热力与剖面，不从正午结果推造全天日照或低碳分数。</p>}
 <details className="simulation-disclosure" open={diagnostics} onToggle={e=>setDiagnostics(e.currentTarget.open)}><summary>当前模拟指标与建筑剖面<ChevronDown size={15}/></summary><div>{children}</div></details>
 <div className="score-optimize"><button className="optimize-button" onClick={onOptimize} disabled={!canOptimize||busy}>{busy?'正在优化参数…':example?'优化构件':'优化评分'}</button>{busy&&<button className="text-button" onClick={onCancel}>取消寻优</button>}<p>以实际后端目标为准，不承诺分数提升或S级。演示模式仍是原网格评分，非此独立评分示例。</p></div>
 </div>{previewDimension&&renderDepthPreview&&<div className="linked-section-preview">{renderDepthPreview("score-linked-desktop")}</div>}</section>;
}
