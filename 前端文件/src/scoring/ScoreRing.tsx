import {useEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {formatScore,gradeColor} from './report';
/** No scoring logic: animate only numbers already supplied by the report. */
export function ScoreRing({value,max,grade}:{value:number|null;max:number;grade:string}){
 const [shown,setShown]=useState(value),meter=useRef({value:value??0});
 useEffect(()=>{
  if(value===null){setShown(null);return}
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation=gsap.to(meter.current,{value,duration:reduced?0:.45,ease:'power2.out',onUpdate:()=>setShown(meter.current.value)});
  return()=>{animation.kill()};
 },[value]);
 const circumference=2*Math.PI*20,progress=shown===null?0:Math.min(1,Math.max(0,shown/max));
 return <><svg className="score-ring" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="1.4"/><circle cx="24" cy="24" r="20" fill="none" stroke={gradeColor(grade)} strokeWidth="1.7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference*(1-progress)} transform="rotate(-90 24 24)"/><text x="24" y="28" textAnchor="middle" fill="currentColor" fontSize="12">{grade||'—'}</text></svg><span className="score-number" aria-hidden="true">{formatScore(shown)}</span></>;
}
