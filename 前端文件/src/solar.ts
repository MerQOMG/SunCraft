import type { Season, Simulation } from './model';
/** World: east +X, up +Y, north +Z. At solar noon the east component is exactly zero. */
export function solarNoon(latitude:number,season:Season,angles?:Simulation['solar_angles']) {
 const declination=season==='summer'?23.44:-23.44;
 const calculated=90-Math.abs(latitude-declination);
 const altitude=angles?(season==='summer'?angles.summer_noon_alt:angles.winter_noon_alt):calculated;
 const rad=altitude*Math.PI/180;
 const south=latitude>=declination;
 return {altitude,declination,south,direction:{x:0,y:Math.sin(rad),z:(south?-1:1)*Math.cos(rad)}};
}
/** A ray entering a south window travels north and down at the solar altitude.
 * Its line must not be redirected to match a heuristic/backend metric depth. */
export function southWindowRay(top:number,latitude:number,season:Season,angles?:Simulation['solar_angles']) {
 const solar=solarNoon(latitude,season,angles);
 const depth=solar.south?top/Math.tan(solar.altitude*Math.PI/180):0;
 return {...solar,depth,intersectsFloor:solar.south&&depth<=6};
}
