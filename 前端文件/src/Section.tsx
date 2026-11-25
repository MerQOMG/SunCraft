import { useId } from 'react';
import type { Parameters, Season, Simulation } from './model';
import { windowGeometry } from './model';
import { solarNoon } from './solar';
import { LOUVER } from './shading';
import { INK, FONT_STACK } from './presentation';
export default function Section({parameters:p,result,season,highlightWinter=false,drawingId='section-drawing'}:{parameters:Parameters;result:Simulation|null;season:Season;highlightWinter?:boolean;drawingId?:string}){
 const id=useId().replace(/:/g,'');const win=windowGeometry(p.window_wall_ratio),scale=38;
 const y=(v:number)=>190-v*scale,x=(v:number)=>88+v*scale;
 function ray(which:Season){
  const sun=solarNoon(p.latitude,which,result?.solar_angles),color=which==='summer'?INK.summer:INK.winter,rad=sun.altitude*Math.PI/180;
  const entry=win.top-.06-p.overhang_depth_m*Math.tan(rad),blocked=entry<win.sill||!sun.south;
  if(!sun.south)return <g key={which} fill="none" stroke={color} strokeWidth="1.4" opacity={season===which?1:.45}><path d={`M${x(5.5)} ${y(3.8)}L${x(5.5-.8*Math.cos(rad))} ${y(3.8-.8*Math.sin(rad))}`}/></g>;
  const target=blocked?{xx:-p.overhang_depth_m/2,yy:win.top+.12}:{xx:0,yy:entry};
  const start={xx:target.xx-Math.cos(rad)*.85,yy:target.yy+Math.sin(rad)*.85};
  const depth=entry/Math.tan(rad),end={xx:Math.min(6,depth),yy:Math.max(0,entry-6*Math.tan(rad))};
  return <g key={which} fill="none" stroke={color} strokeWidth={season===which?1.8:1.1} opacity={season===which?1:.5}>
   <path d={`M${x(start.xx)} ${y(start.yy)}L${x(target.xx)} ${y(target.yy)}${blocked?'':`L${x(end.xx)} ${y(end.yy)}`}`}/>
   {blocked&&<path d={`M${x(target.xx)-2.5} ${y(target.yy)-2.5}l5 5m-5 0l5-5`}/>}
  </g>;
 }
 const summer=solarNoon(p.latitude,'summer',result?.solar_angles),winter=solarNoon(p.latitude,'winter',result?.solar_angles);
 return <svg id={drawingId} role="img" aria-label="南北向客厅剖面，含冬夏太阳几何与建筑尺寸" viewBox="0 0 370 256" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'auto',fontFamily:FONT_STACK}}>
 <desc>太阳几何示意，百叶细部遮挡以三维视图为准。水平虚线表示冬季结果深度，不改变射线角度。</desc><defs><pattern id={`hatch${id}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#69706f" strokeWidth=".55"/></pattern><marker id={`arr${id}`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M0 0L5 2.5L0 5" fill="none" stroke="#767d7a" strokeWidth=".8"/></marker></defs>
 <rect width="370" height="256" fill="transparent"/>
 {[0,1,2,3,4,5,6].map(n=><line key={n} x1={x(n)} y1="53" x2={x(n)} y2="210" stroke="#6e7774" opacity=".12" strokeDasharray="2 4"/>)}
 <g stroke="#3e4946" strokeWidth="1.3" fill={`url(#hatch${id})`}><path d={`M82 190H322V197H82Z M82 ${y(win.sill)}V190H88V${y(win.sill)}Z M82 ${y(3)}H88V${y(win.top)}H82Z M316 ${y(3)}H322V190H316Z`}/><path d={`M82 ${y(3)}H322`} strokeDasharray="4 3" fill="none"/></g>
 <line x1="85" y1={y(win.top)} x2="85" y2={y(win.sill)} stroke="#92a4a5" strokeWidth="2"/>
 <path d={`M${x(-p.overhang_depth_m)} ${y(win.top+.12)}H88`} stroke="#3e4946" strokeWidth="4.5"/>
 {Array.from({length:LOUVER.count},(_,i)=>{const yy=y(win.sill+(i+.5)*win.height/LOUVER.count);const angle=p.louver_angle_deg*Math.PI/180;return <line key={i} x1={80-Math.cos(angle)*LOUVER.chord_m*scale/2} y1={yy-Math.sin(angle)*LOUVER.chord_m*scale/2} x2={80+Math.cos(angle)*LOUVER.chord_m*scale/2} y2={yy+Math.sin(angle)*LOUVER.chord_m*scale/2} stroke="#707975" strokeWidth=".7"/>})}
 <g fill="#d6d9d3" stroke="#707973" strokeWidth=".9"><path d="M206 190v-11q0-3 3-3h9v-17q0-4 4-4h10q4 0 4 4v20h12v11z"/><path d="M137 177h39v4h-39z M143 181v9 M170 181v9"/><path d="M280 176h27v14h-27z"/></g>
 {ray('summer')}{ray('winter')}
 {result&&<g data-result-depth={result.svg_rays.winter_hit_depth} stroke="#858d86" strokeWidth=".7" fill="none"><path d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} strokeDasharray="2 2"/><path d={`M${x(result.svg_rays.winter_hit_depth)} 201v6`}/>{highlightWinter&&<g data-analysis-annotation="winter-depth"><path d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} stroke={INK.paper} strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path data-highlighted-depth="true" d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} stroke={INK.forest} strokeWidth="3.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path d={`M${x(result.svg_rays.winter_hit_depth)} 198v12`} stroke={INK.forest} strokeWidth="2" vectorEffect="non-scaling-stroke"/><circle cx={x(result.svg_rays.winter_hit_depth)} cy="204" r="2.8" fill={INK.forest} stroke={INK.paper} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}</g>}
 <g stroke="#7f8882" strokeWidth=".6" fill="none"><path d="M88 211v13 M316 211v13 M328 76h16 M328 190h16"/><path d="M88 218H316" markerStart={`url(#arr${id})`} markerEnd={`url(#arr${id})`}/><path d="M339 76V190" markerStart={`url(#arr${id})`} markerEnd={`url(#arr${id})`}/></g>
 <g fill={INK.muted} fontSize="18.5"><text x="170" y="233">6 000 mm</text><text x="352" y="150" transform="rotate(-90 352 150)">3 000 mm</text><text x="81" y="250">S / 南</text><text x="297" y="250">N / 北</text></g>
 <text x="14" y="19" fill={INK.summer} fontSize="20" fontWeight="550">夏至 {summer.altitude.toFixed(1)}°{summer.south?'':' / 北侧'}</text><text x="210" y="19" fill={INK.winter} fontSize="20" fontWeight="550">冬至 {winter.altitude.toFixed(1)}°</text>
 {result&&<g fill={INK.muted} fontSize="18"><text x="14" y="43">夏季：{result.svg_rays.summer_blocked?'阻挡':'未完全阻挡'}</text><text x="210" y="43">虚线：冬季深度</text></g>}
 </svg>
}
