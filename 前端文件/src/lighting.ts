import {Color,SRGBColorSpace} from 'three';
import type {Parameters,Season} from './model.ts';
import {windowGeometry} from './model.ts';
import {LOUVER,FINISH} from './shading.ts';
/** Rendering calibration, NOT lux, a backend result, or a validated radiosity solver. */
export const LIGHTING={exposure:1.10,environment:.10,skyRadiance:9.5,floorReflectance:.48,wallReflectance:.76,floorFluxShare:.32,northFluxShare:.12,aoRadius_m:.14,aoIntensity:.32,aoMaxDimension:900} as const;
type V={x:number;y:number;z:number};
function boxHit(o:number[],d:number[],h:number[]){let near=-Infinity,far=Infinity;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-10){if(Math.abs(o[i])>h[i])return false}else{let a=(-h[i]-o[i])/d[i],b=(h[i]-o[i])/d[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return false}}return far>Math.max(near,1e-5)}
function exteriorBlocked(p:Parameters,o:V,d:V){
 const win=windowGeometry(p.window_wall_ratio),depth=Math.max(.015,p.overhang_depth_m);
 const hits=(x:number,y:number,z:number,w:number,h:number,dz:number)=>boxHit([o.x-x,o.y-y,o.z-z],[d.x,d.y,d.z],[w/2,h/2,dz/2]);
 // Include wall thickness and the closed roof: at high summer altitude a ray can enter
 // the inner opening yet hit the upper reveal before reaching the exterior face.
 if(hits(0,3.06,0,5.56,.12,6.16)||hits(0,(3+win.top)/2,-3.08,4.4,3-win.top,.16)||hits(0,win.sill/2,-3.08,4.4,win.sill,.16))return true;
 if(hits(-2.45,1.5,-3.08,.5,3,.16)||hits(2.45,1.5,-3.08,.5,3,.16))return true;
 if(hits(0,win.top,-3,4.5,.055,.12)||hits(0,win.sill,-3,4.5,.055,.14)||hits(0,win.sill-.04,-2.97,4.6,.065,.35))return true;
 for(const x of [-2.2,2.2])if(hits(x,1.5,-3,.055,win.height,.1))return true;
 for(const x of [-.74,.74])if(hits(x,1.5,-3,.035,win.height,.07))return true;
 if(boxHit([o.x,o.y-win.top-.12,o.z+3.1+depth/2],[d.x,d.y,d.z],[2.45,.06,depth/2]))return true;
 const angle=p.louver_angle_deg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<LOUVER.count;i++){const y=o.y-(win.sill+(i+.5)*win.height/LOUVER.count),z=o.z+3+LOUVER.offset_m;
  if(boxHit([o.x,y*c+z*s,-y*s+z*c],[d.x,d.y*c+d.z*s,-d.y*s+d.z*c],[2.2,LOUVER.thickness_m/2,LOUVER.chord_m/2]))return true;
 }return false;
}
/** 768 cosine-weighted aperture samples, upper sky; global diffuse visibility approximation. */
export function apertureSkyFraction(p:Parameters){const win=windowGeometry(p.window_wall_ratio);let open=0,total=0;
 for(let y=0;y<4;y++)for(let x=0;x<6;x++)for(let i=0;i<32;i++){const u=(i+.5)/32,r=Math.sqrt(u),phi=Math.PI*((i*.61803398875)%1),d={x:r*Math.cos(phi),y:r*Math.sin(phi),z:-Math.sqrt(1-u)},o={x:((x+.5)/6-.5)*4.3,y:win.sill+(y+.5)*win.height/4,z:-3.001};if(!exteriorBlocked(p,o,d))open++;total++}return open/total;
}
/** Coarse furniture-free floor visibility, used ONLY to budget first-bounce rendering energy. */
export function floorSunFraction(p:Parameters,d:V){if(d.y<=0||d.z>=0)return 0;const win=windowGeometry(p.window_wall_ratio);let open=0;
 for(let i=0;i<768;i++){const o={x:-2.7+(i+.5)*5.4/768,y:FINISH.floorTop_m,z:-3+((i*.61803398875+.137)%1)*6},t=(-3-o.z)/d.z,wx=o.x+t*d.x,wy=o.y+t*d.y;
  if(t<=0||wy<win.sill+.0275||wy>win.top-.0275||Math.abs(wx)>2.1725||Math.abs(wx-.74)<.0175||Math.abs(wx+.74)<.0175)continue;
  if(!exteriorBlocked(p,o,d))open++;
 }return open/768;
}
export function kelvinColor(kelvin:number){const t=Math.max(1900,Math.min(kelvin,12000))/100,clamp=(v:number)=>Math.max(0,Math.min(255,v))/255;
 const r=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
 return new Color().setRGB(clamp(r),clamp(g),clamp(b),SRGBColorSpace);
}
export function lightingBudget(p:Parameters,season:Season,sun:V){const win=windowGeometry(p.window_wall_ratio),skyFraction=apertureSkyFraction(p),portal=LIGHTING.skyRadiance*skyFraction,sunIntensity=season==='summer'?5.6:5,sunFloorFraction=floorSunFraction(p,sun),area=4.3*Math.max(.1,win.height-.055);
 const skyFloor=portal*area/(5.4*6)*LIGHTING.floorFluxShare*LIGHTING.floorReflectance;
 const directFloor=sunIntensity*Math.max(0,sun.y)*sunFloorFraction*LIGHTING.floorReflectance/Math.PI;
 return {exposure:LIGHTING.exposure,skyFraction,sunFloorFraction,portal,floorBounce:skyFloor+directFloor,northBounce:portal*area/(5.4*2.7)*LIGHTING.northFluxShare*LIGHTING.wallReflectance,sunIntensity,sunColor:kelvinColor(season==='summer'?6000:5200)};
}
