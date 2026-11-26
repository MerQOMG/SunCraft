/** 2026 daily noon geometry preview. Not a new backend performance model.
 * Equations: NOAA/GML main.js (Meeus), calcSunDeclination / corrected obliquity.
 * Each calendar day uses its UTC12 declination as a daily representative; H=0.
 * No atmospheric refraction, clock-time claim, winter/summer interpolation or score calculation.
 */
import type {Parameters,Ray} from './model';
import type {RoomGeometry} from './geometry';
import {shadeGeometry} from './geometry';
export const PREVIEW_YEAR=2026,DAY_COUNT=365;
const START=Date.UTC(PREVIEW_YEAR,0,1),MS_DAY=86400000,R=Math.PI/180;
export const SOLAR_TERMS=[['小寒','01-05'],['大寒','01-20'],['立春','02-04'],['雨水','02-18'],['惊蛰','03-05'],['春分','03-20'],['清明','04-05'],['谷雨','04-20'],['立夏','05-05'],['小满','05-21'],['芒种','06-05'],['夏至','06-21'],['小暑','07-07'],['大暑','07-23'],['立秋','08-07'],['处暑','08-23'],['白露','09-07'],['秋分','09-23'],['寒露','10-08'],['霜降','10-23'],['立冬','11-07'],['小雪','11-22'],['大雪','12-07'],['冬至','12-22']].map(([name,md])=>({name,date:`2026-${md}`,day:Math.round((Date.parse(`2026-${md}T00:00:00Z`)-START)/MS_DAY)}));
// HKO Gregorian-Lunar Calendar Conversion Table of 2026. Dates are UTC+8; not a perpetual formula.
export const SUMMER_DAY=SOLAR_TERMS.find(t=>t.name==='夏至')!.day,WINTER_DAY=SOLAR_TERMS.find(t=>t.name==='冬至')!.day;
export function dateFromDay(day:number){if(!Number.isInteger(day)||day<0||day>=DAY_COUNT)throw Error('仅支持2026年日历');return new Date(START+day*MS_DAY).toISOString().slice(0,10)}
export function dayFromDate(iso:string):number|null {if(!/^2026-\d{2}-\d{2}$/.test(iso))return null;const day=(Date.parse(iso+'T00:00:00Z')-START)/MS_DAY;return Number.isInteger(day)&&day>=0&&day<DAY_COUNT&&dateFromDay(day)===iso?day:null}
export function termAt(day:number){const exact=SOLAR_TERMS.find(t=>t.day===day);const previous=SOLAR_TERMS.filter(t=>t.day<day).at(-1);return {exact,label:exact?.name??(previous?`${previous.name}后`:'小寒前')}}
export function declinationAtJulianDay(jd:number){const t=(jd-2451545)/36525;
 const meanLongitude=((280.46646+t*(36000.76983+t*.0003032))%360+360)%360;
 const anomaly=(357.52911+t*(35999.05029-.0001537*t))*R;
 const center=Math.sin(anomaly)*(1.914602-t*(.004817+.000014*t))+Math.sin(2*anomaly)*(.019993-.000101*t)+Math.sin(3*anomaly)*.000289;
 const omega=(125.04-1934.136*t)*R,longitude=(meanLongitude+center-.00569-.00478*Math.sin(omega))*R;
 const seconds=21.448-t*(46.815+t*(.00059-t*.001813));
 const obliquity=(23+(26+seconds/60)/60+.00256*Math.cos(omega))*R;
 return Math.asin(Math.sin(obliquity)*Math.sin(longitude))/R;
}
export interface SolarFrame {day:number;date:string;latitude:number;declination:number;altitude:number;azimuth:number|null;south:boolean;aboveHorizon:boolean;direction:{x:number;y:number;z:number};solarTime:'12:00';source:'NOAA-Meeus / daily frontend geometry'}
export function annualSolarFrame(day:number,latitude:number):SolarFrame {const date=dateFromDay(day);if(!Number.isFinite(latitude)||Math.abs(latitude)>90)throw Error('纬度无效');
 const jd=(START+(day+.5)*MS_DAY)/MS_DAY+2440587.5,declination=declinationAtJulianDay(jd),delta=(latitude-declination)*R;
 const altitude=90-Math.abs(latitude-declination),south=latitude>=declination;
 return {day,date,latitude,declination,altitude,azimuth:Math.abs(delta)<1e-10?null:south?180:0,south,aboveHorizon:altitude>0,direction:{x:0,y:Math.cos(delta),z:-Math.sin(delta)},solarTime:'12:00',source:'NOAA-Meeus / daily frontend geometry'};
}
/** Representative geometric rays only. No percentage, DF, duration, score or max-depth metric. */
export function previewRays(p:Parameters,room:RoomGeometry,frame:SolarFrame):Ray[]{if(!frame.aboveHorizon||!frame.south||Math.abs(frame.direction.z)<1e-10)return [];
 const g=shadeGeometry(p,room),w=g.window,slope=frame.direction.y/-frame.direction.z;
 const intervals:[number,number][]=[];
 if(g.canopy.visible)intervals.push([Math.max(w.sill,w.top-g.canopy.depth*slope),w.top]);
 for(const b of g.blades){const lower=Math.max(w.sill,b.outerHeight+b.outerDepth*slope),upper=Math.min(w.top,b.rootHeight);if(upper>lower)intervals.push([lower,upper])}
 intervals.sort((a,b)=>b[1]-a[1]);let cursor=w.top,entry:number|null=null;
 for(const [lo,hi]of intervals){if(hi<cursor-1e-8){entry=cursor-Math.min(1e-5,(cursor-hi)/4);break}cursor=Math.min(cursor,lo)}
 if(entry===null&&cursor>w.sill+1e-8)entry=cursor-Math.min(1e-5,(cursor-w.sill)/4);
 const rays:Ray[]=[],dx=.5/Math.hypot(1,slope);
 if(g.canopy.visible||g.blades.length){const hit=g.canopy.visible?{d:-g.canopy.depth/2,h:w.top}:{d:g.blades[0].centerDepth,h:g.blades[0].centerHeight};rays.push({kind:'blocked',start:[hit.d-dx,hit.h+dx*slope],end:[hit.d,hit.h]})}
 if(entry!==null){const reach=Math.min(room.depth_m,entry/slope);rays.push({kind:'transmitted',start:[-dx,entry+dx*slope],window_entry:[0,entry],end:[reach,Math.max(0,entry-reach*slope)]})}
 return rays;
}
