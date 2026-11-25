export type LinkTarget='sofa'|'winter-depth';
export type CitationKind='mandatory'|'reference'|'project'|'unspecified';
export interface ScoreItem {key:string;name:string;value_display:string;threshold_display:string;score:number|null;max_score:number;status:'pass'|'warn'|'fail'|'pending';citation:string;citation_kind:CitationKind;link_target?:LinkTarget}
export interface ScoreDimension {id:string;name:string;weight:number;score:number|null;items:ScoreItem[]}
export interface ScoreWarning {id:string;message:string;severity:'notice'|'warning';item_keys:string[]}
export interface ScoreReport {total_score:number|null;max_score:number;grade:string;grade_label:string;warnings:ScoreWarning[];methodology_note:string;dimensions:ScoreDimension[];provenance:'example'|'backend';completeness:'partial'|'complete';version?:string}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=2000):v is string=>typeof v==='string'&&v.length<=max;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function value(v:unknown,max:number){if(v===null)return null;if(!finite(v)||v<0||v>max)throw Error('评分超出本项分值范围');return v}
const linkage:Record<string,LinkTarget>={sofa_exposure_hours:'sofa',sofa_summer_exposure_hours:'sofa',winter_penetration_m:'winter-depth',winter_sun_depth:'winter-depth'};
/** Normalize optional additive contract; never derive thresholds, weights, scores or grades here. */
export function adaptScoreReport(input:unknown):ScoreReport {
 if(!object(input)||!text(input.grade,50)||!text(input.grade_label,300)||!text(input.methodology_note)||!Array.isArray(input.dimensions)||!input.dimensions.length||input.dimensions.length>20||!Array.isArray(input.warnings)||input.warnings.length>100)throw Error('score_report 基础字段无效');
 const max=input.max_score===undefined?100:input.max_score;if(max!==100)throw Error('评分报告需采用100分制');
 const dimensions:ScoreDimension[]=input.dimensions.map(d=>{
  if(!object(d)||!text(d.id,100)||!text(d.name,200)||!finite(d.weight)||d.weight<0||d.weight>max||!Array.isArray(d.items)||d.items.length>50)throw Error('评分维度无效');
  const items:ScoreItem[]=d.items.map(i=>{
   if(!object(i)||!text(i.key,100)||!text(i.name,200)||!text(i.value_display,500)||!text(i.threshold_display,500)||!finite(i.max_score)||i.max_score<0||!['pass','warn','fail','pending'].includes(i.status as string)||!text(i.citation))throw Error('评分子项无效');
   const kind=i.citation_kind??'unspecified';if(!['mandatory','reference','project','unspecified'].includes(kind as string))throw Error('来源分类无效');
   const target=i.link_target??linkage[i.key];if(target!==undefined&&!['sofa','winter-depth'].includes(target as string))throw Error('未知空间联动对象');
   return {key:i.key,name:i.name,value_display:i.value_display,threshold_display:i.threshold_display,score:value(i.score,i.max_score),max_score:i.max_score,status:i.status as ScoreItem['status'],citation:i.citation,citation_kind:kind as CitationKind,...(target?{link_target:target as LinkTarget}:{})};
  });
  if(new Set(items.map(i=>i.key)).size!==items.length)throw Error('评分子项key重复');
  const score=value(d.score,d.weight),sum=items.reduce((s,i)=>s+(i.score??0),0),cap=items.reduce((s,i)=>s+i.max_score,0);
  if(cap>d.weight+.11||score!==null&&items.length&&items.every(i=>i.score!==null)&&Math.abs(sum-score)>.11)throw Error('维度得分与子项贡献不一致');
  return {id:d.id,name:d.name,weight:d.weight,score,items};
 });
 if(new Set(dimensions.map(d=>d.id)).size!==dimensions.length)throw Error('评分维度id重复');
 const total=value(input.total_score,max),capacity=dimensions.reduce((s,d)=>s+d.weight,0),sum=dimensions.reduce((s,d)=>s+(d.score??0),0);
 if(capacity>max+.11)throw Error('维度权重超出总分');
 if(input.completeness==='complete'&&Math.abs(capacity-max)>.11)throw Error('完整报告缺少维度权重');
 const complete=Math.abs(capacity-max)<.11&&dimensions.every(d=>Math.abs(d.items.reduce((s,i)=>s+i.max_score,0)-d.weight)<.11);
 if(complete&&total!==null&&dimensions.every(d=>d.score!==null)&&Math.abs(total-sum)>.11)throw Error('总分与维度贡献不一致');
 const warnings:ScoreWarning[]=input.warnings.map((w,index)=>{
  if(typeof w==='string'&&!text(w))throw Error('评分警示过长');
  if(typeof w==='string')return {id:`warning-${index}`,message:w,severity:'warning',item_keys:[]};
  if(!object(w)||!text(w.message)||w.id!==undefined&&!text(w.id,100)||w.severity!==undefined&&!['notice','warning'].includes(w.severity as string)||w.item_keys!==undefined&&(!Array.isArray(w.item_keys)||!w.item_keys.every(k=>text(k,100))))throw Error('评分警示无效');
  return {id:typeof w.id==='string'?w.id:`warning-${index}`,message:w.message,severity:w.severity==='notice'?'notice':'warning',item_keys:(w.item_keys??[]) as string[]};
 });
 return {total_score:total,max_score:max,grade:input.grade,grade_label:input.grade_label,warnings,methodology_note:input.methodology_note,dimensions,provenance:input.provenance==='example'?'example':'backend',completeness:complete?'complete':'partial',...(text(input.version,100)?{version:input.version}:{})};
}
/** Grade only determines presentation color. Classification itself comes from the report. */
export const gradeColor=(grade:string)=>grade==='S'||grade==='A'?'#3D7A5E':grade==='B'?'#C88A2E':grade==='C'?'#C25243':'#55655c';
export const formatScore=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toFixed(1);
