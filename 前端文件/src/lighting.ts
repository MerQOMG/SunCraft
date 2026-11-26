import { Color, SRGBColorSpace } from 'three';
import type { Parameters, Season } from './model.ts';
import { shadeGeometry, windowGeometry, RENDER_FLOOR_Y } from './geometry';
import type { RoomGeometry } from './geometry';
import { FINISH } from './shading.ts';
/** Rendering calibration, NOT lux, a backend result, or a validated radiosity solver.
 * One bounded rebalance: lower undirected IBL and first-bounce fill, raise aperture-origin
 * key light, slightly stronger annual direct (shadowed by real geometry). Exposure stays put.
 * Daylight-only fill is off below the horizon; north-side sun still gets sky diffuse,
 * never a fictional direct-floor bounce. AO is a tighter geometric contact, not a vignette.
 */
export const LIGHTING = {
  exposure: 1.1,
  environment: 0.03,
  skyRadiance: 15.5,
  skyKelvin: 6400,
  floorReflectance: 0.48,
  wallReflectance: 0.76,
  floorFluxShare: 0.18,
  northFluxShare: 0.06,
  aoRadius_m: 0.08,
  aoIntensity: 0.45,
  aoMaxDimension: 900,
} as const;
type V = { x: number; y: number; z: number };
function exteriorBlocked(p: Parameters, o: V, d: V, room: RoomGeometry) {
  const g = shadeGeometry(p, room),
    w = g.window,
    facade = -room.depth_m / 2,
    f = RENDER_FLOOR_Y;
  if (d.z >= -1e-10) return true;
  const t = (facade - o.z) / d.z;
  const x = o.x + t * d.x,
    h = o.y + t * d.y - f;
  if (t < 0 || Math.abs(x) > w.width / 2 || h < w.sill || h > w.top) return true;
  if (g.canopy.visible && d.y > 1e-10) {
    const tc = (f + w.top - o.y) / d.y,
      z = o.z + tc * d.z;
    if (tc > 0 && z <= facade && z >= facade - g.canopy.depth) return true;
  }
  const c = Math.cos(g.angle),
    s = Math.sin(g.angle);
  for (const b of g.blades) {
    const denom = c * d.y - s * d.z;
    if (Math.abs(denom) < 1e-10) continue;
    const tb = (c * (b.rootHeight + f - o.y) - s * (facade - o.z)) / denom;
    if (tb <= 0) continue;
    const along = -(o.y + tb * d.y - b.rootHeight - f) * s - (o.z + tb * d.z - facade) * c;
    if (along >= 0 && along <= room.slat_chord_m) return true;
  }
  return false;
}
/** 768 cosine-weighted aperture samples, upper sky; global diffuse visibility approximation. */
export function apertureSkyFraction(p: Parameters, room: RoomGeometry) {
  const win = windowGeometry(p.window_wall_ratio, room);
  let open = 0,
    total = 0;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 6; x++)
      for (let i = 0; i < 32; i++) {
        const u = (i + 0.5) / 32,
          r = Math.sqrt(u),
          phi = Math.PI * ((i * 0.61803398875) % 1),
          d = { x: r * Math.cos(phi), y: r * Math.sin(phi), z: -Math.sqrt(1 - u) },
          o = {
            x: ((x + 0.5) / 6 - 0.5) * win.width,
            y: RENDER_FLOOR_Y + win.sill + ((y + 0.5) * win.height) / 4,
            z: -room.depth_m / 2 + 0.0001,
          };
        if (!exteriorBlocked(p, o, d, room)) open++;
        total++;
      }
  return open / total;
}
/** Coarse furniture-free floor visibility, used ONLY to budget first-bounce rendering energy. */
export function floorSunFraction(p: Parameters, d: V, room: RoomGeometry) {
  if (d.y <= 0 || d.z >= 0) return 0;
  let open = 0;
  for (let i = 0; i < 768; i++) {
    const o = {
      x: -room.width_m / 2 + ((i + 0.5) * room.width_m) / 768,
      y: FINISH.floorTop_m,
      z: -room.depth_m / 2 + ((i * 0.61803398875 + 0.137) % 1) * room.depth_m,
    };
    if (!exteriorBlocked(p, o, d, room)) open++;
  }
  return open / 768;
}
export function kelvinColor(kelvin: number) {
  const t = Math.max(1900, Math.min(kelvin, 12000)) / 100,
    clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592),
    g =
      t <= 66
        ? 99.4708025861 * Math.log(t) - 161.1195681661
        : 288.1221695283 * Math.pow(t - 60, -0.0755148492),
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new Color().setRGB(clamp(r), clamp(g), clamp(b), SRGBColorSpace);
}
export function lightingBudget(
  p: Parameters,
  season: Season | 'annual',
  sun: V,
  room: RoomGeometry,
) {
  const win = windowGeometry(p.window_wall_ratio, room),
    skyFraction = apertureSkyFraction(p, room),
    daylight = sun.y > 0 ? 1 : 0,
    portal = LIGHTING.skyRadiance * skyFraction * daylight,
    sunIntensity = daylight * (season === 'annual' ? 6.2 : season === 'summer' ? 6.55 : 5.85),
    sunFloorFraction = floorSunFraction(p, sun, room),
    area = win.width * win.height;
  const skyFloor =
    ((portal * area) / (room.width_m * room.depth_m)) *
    LIGHTING.floorFluxShare *
    LIGHTING.floorReflectance;
  const directFloor =
    (sunIntensity * Math.max(0, sun.y) * sunFloorFraction * LIGHTING.floorReflectance) / Math.PI;
  return {
    exposure: LIGHTING.exposure,
    environment: LIGHTING.environment * daylight,
    skyFraction,
    sunFloorFraction,
    portal,
    floorBounce: skyFloor + directFloor,
    northBounce:
      ((portal * area) / (room.width_m * room.height_m)) *
      LIGHTING.northFluxShare *
      LIGHTING.wallReflectance,
    sunIntensity,
    sunColor: kelvinColor(season === 'annual' ? 5600 : season === 'summer' ? 6000 : 5200),
  };
}
