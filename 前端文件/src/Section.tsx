import {previewRays} from './annual';
import type {SolarFrame} from './annual';
import { useId } from 'react';
import type { Parameters, Season, Simulation } from './model';
import {shadeGeometry} from './geometry';
import type {RoomGeometry} from './geometry';
import { solarNoon } from './solar';
import { INK, FONT_STACK } from './presentation';
export default function Section({previewFrame,room,parameters:p,result,season,highlightWinter=false,drawingId='section-drawing'}:{previewFrame?:SolarFrame;room:RoomGeometry|null;parameters:Parameters;result:Simulation|null;season:Season;highlightWinter?:boolean;drawingId?:string}){
 const id=useId().replace(/:/g,'');
 if(!room)return <svg id={drawingId} role="img" aria-label="几何契约未同步" viewBox="0 0 370 120"><text x="12" y="50" fontSize="18" fill={INK.text}>几何未同步，剖面暂不绘制</text></svg>;
 const g=shadeGeometry(p,room),win=g.window,scale=Math.min(228/room.depth_m,114/room.height_m);
 const y=(v:number)=>190-v*scale,x=(v:number)=>88+v*scale;
 function ray(which:Season){const rays=result?.svg_rays[which],incident=which==='summer'?result?.svg_rays.summer_incident:result?.svg_rays.winter_incident;if(incident===false||!rays?.length)return null;
  const color=which==='summer'?INK.summer:INK.winter;
  return <g key={which} data-ray-source="backend" fill="none" stroke={color} strokeWidth={season===which?1.8:1.1} opacity={season===which?1:.5}>{rays.map((r,i)=><g key={i} data-ray-kind={r.kind}>
   <path d={`M${x(r.start[0])} ${y(r.start[1])}${r.window_entry?`L${x(r.window_entry[0])} ${y(r.window_entry[1])}`:''}L${x(r.end[0])} ${y(r.end[1])}`}/>
   {r.kind==='blocked'&&<path d={`M${x(r.end[0])-2.5} ${y(r.end[1])-2.5}l5 5m-5 0l5-5`}/>}
  </g>)}</g>;
 }
 const summer=solarNoon(p.latitude,'summer',result?.solar_angles),winter=solarNoon(p.latitude,'winter',result?.solar_angles);
 return <svg id={drawingId} role="img" aria-label={previewFrame?`${previewFrame.date}真太阳正午前端几何剖面`:result?'南北向冬夏设计工况剖面，结果代表射线':'工况结果未就绪，仅显示几何'} viewBox="0 0 370 256" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'auto',fontFamily:FONT_STACK}}>
 <desc>{previewFrame?'当前日期太阳方向与三维同源，前端理想面几何代表线，非当天性能或后端结果；无冬深结果虚线。':result?'冬夏设计工况代表射线（若有）。水平虚线为工况返回的冬季结果深度，不是当前日期预览结果。':'接口工况数据未就绪，仅显示理想几何，不显示推导角度、射线或结果深度。'}</desc><defs><pattern id={`hatch${id}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#69706f" strokeWidth=".55"/></pattern><marker id={`arr${id}`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse"><path d="M0 0L5 2.5L0 5" fill="none" stroke="#767d7a" strokeWidth=".8"/></marker></defs>
 <rect width="370" height="256" fill="transparent"/>
 {Array.from({length:Math.floor(room.depth_m)+1},(_,i)=>i).map(n=><line key={n} x1={x(n)} y1="53" x2={x(n)} y2="210" stroke="#6e7774" opacity=".12" strokeDasharray="2 4"/>)}
 <g stroke="#3e4946" strokeWidth="1.3" fill={`url(#hatch${id})`}><path d={`M82 190H322V197H82Z M82 ${y(win.sill)}V190H88V${y(win.sill)}Z M82 ${y(room.height_m)}H88V${y(win.top)}H82Z M316 ${y(room.height_m)}H322V190H316Z`}/><path d={`M82 ${y(room.height_m)}H322`} strokeDasharray="4 3" fill="none"/></g>
 <line x1="85" y1={y(win.top)} x2="85" y2={y(win.sill)} stroke="#92a4a5" strokeWidth="2"/>
 {g.canopy.visible&&<path d={`M${x(-g.canopy.depth)} ${y(g.canopy.height)}H88`} stroke="#3e4946" strokeWidth="3"/>}
 {g.blades.map((blade,i)=><line key={i} x1={x(0)} y1={y(blade.rootHeight)} x2={x(blade.outerDepth)} y2={y(blade.outerHeight)} stroke="#707975" strokeWidth="1.1"/>)}
 <g fill="#d6d9d3" stroke="#707973" strokeWidth=".9"><path d="M206 190v-11q0-3 3-3h9v-17q0-4 4-4h10q4 0 4 4v20h12v11z"/><path d="M137 177h39v4h-39z M143 181v9 M170 181v9"/><path d="M280 176h27v14h-27z"/></g>
 {previewFrame?<g data-ray-source="frontend-date-geometry" data-solar-date={previewFrame.date} data-solar-altitude={previewFrame.altitude} fill="none" stroke={INK.forest} strokeWidth="1.8">{previewRays(p,room,previewFrame).map((r,i)=><g key={i} data-ray-kind={r.kind}><path d={`M${x(r.start[0])} ${y(r.start[1])}${r.window_entry?`L${x(r.window_entry[0])} ${y(r.window_entry[1])}`:''}L${x(r.end[0])} ${y(r.end[1])}`}/>{r.kind==='blocked'&&<path d={`M${x(r.end[0])-2.5} ${y(r.end[1])-2.5}l5 5m-5 0l5-5`}/>}</g>)}</g>:<>{ray('summer')}{ray('winter')}</>}
 {!previewFrame&&result&&<g data-result-depth={result.svg_rays.winter_hit_depth} stroke="#858d86" strokeWidth=".7" fill="none"><path d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} strokeDasharray="2 2"/><path d={`M${x(result.svg_rays.winter_hit_depth)} 201v6`}/>{highlightWinter&&<g data-analysis-annotation="winter-depth"><path d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} stroke={INK.paper} strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path data-highlighted-depth="true" d={`M88 204H${x(result.svg_rays.winter_hit_depth)}`} stroke={INK.forest} strokeWidth="3.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path d={`M${x(result.svg_rays.winter_hit_depth)} 198v12`} stroke={INK.forest} strokeWidth="2" vectorEffect="non-scaling-stroke"/><circle cx={x(result.svg_rays.winter_hit_depth)} cy="204" r="2.8" fill={INK.forest} stroke={INK.paper} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}</g>}
 <g stroke="#7f8882" strokeWidth=".6" fill="none"><path d="M88 211v13 M316 211v13 M328 76h16 M328 190h16"/><path d="M88 218H316" markerStart={`url(#arr${id})`} markerEnd={`url(#arr${id})`}/><path d="M339 76V190" markerStart={`url(#arr${id})`} markerEnd={`url(#arr${id})`}/></g>
 <g fill={INK.muted} fontSize="18.5"><text x="170" y="233">{Math.round(room.depth_m*1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')} mm</text><text x="352" y="150" transform="rotate(-90 352 150)">{Math.round(room.height_m*1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')} mm</text><text x="81" y="250">S / 南</text><text x="297" y="250">N / 北</text></g>
 {previewFrame?<><text x="14" y="19" fill={INK.forest} fontSize="18" fontWeight="550">{previewFrame.date} · 高度 {previewFrame.altitude.toFixed(1)}°</text><text x="14" y="43" fill={INK.muted} fontSize="15">真太阳正午 · {previewFrame.aboveHorizon?(previewFrame.south?'前端理想面代表射线':'北侧太阳，南窗无正面入射'):'太阳低于地平线'}</text></>:result?<>
 <text x="14" y="19" fill={INK.summer} fontSize="20" fontWeight="550">夏至 {summer.altitude.toFixed(1)}°{summer.south?'':' / 北侧'}</text><text x="210" y="19" fill={INK.winter} fontSize="20" fontWeight="550">冬至 {winter.altitude.toFixed(1)}°</text>
 {result&&!result.svg_rays.summer?.length&&!result.svg_rays.winter?.length&&<text x="12" y="67" fontSize="13" fill={INK.muted}>未提供代表射线；仅显示角度/结果深度</text>}
 {result&&<g fill={INK.muted} fontSize="18"><text x="14" y="43">夏季：{result.svg_rays.summer_incident===false?'无正面入射':result.svg_rays.summer_blocked?'阻挡':'未完全阻挡'}</text><text x="210" y="43">虚线：冬季深度</text></g>}
 </>:<><text x="14" y="19" fill={INK.muted} fontSize="18">工况结果未就绪</text><text x="14" y="43" fill={INK.muted} fontSize="15">暂无接口角度、射线或结果深度</text></>}
 </svg>
}
