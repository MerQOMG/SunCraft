import { RENDER_FLOOR_Y } from './geometry';
/** Decorative thickness only. Optical chord/pitch/anchors come from RoomGeometry. */
export const VISUAL_CONSTRUCTION = { bladeThickness_m: 0.012 } as const;
export const FINISH = {
  floorTop_m: RENDER_FLOOR_Y,
  rugThickness_m: 0.025,
  rugTop_m: 0.066,
  sofaLegTop_m: 0.245,
} as const;
export function sofaFoot(onRug: boolean) {
  const bottom = onRug ? FINISH.rugTop_m : FINISH.floorTop_m;
  const height = FINISH.sofaLegTop_m - bottom;
  return { bottom, height, center: bottom + height / 2 };
}
