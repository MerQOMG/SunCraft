import { shadeGeometry, RENDER_FLOOR_Y } from './geometry';
import type { RoomGeometry } from './geometry';
import type { Parameters } from './model';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** Ideal south aperture, canopy and blades. World coordinates match the scene.
 * Build once per design, then reuse for sky samples and date heatmap rays.
 */
export function apertureAccess(p: Parameters, room: RoomGeometry) {
  const geometry = shadeGeometry(p, room),
    window = geometry.window;
  const facade = -room.depth_m / 2,
    floor = RENDER_FLOOR_Y;
  const c = Math.cos(geometry.angle),
    s = Math.sin(geometry.angle);
  return (origin: Vector3Like, direction: Vector3Like): boolean => {
    if (direction.y < 0 || direction.z >= -1e-10) return false;
    const t = (facade - origin.z) / direction.z;
    const x = origin.x + t * direction.x,
      height = origin.y + t * direction.y - floor;
    if (t < 0 || Math.abs(x) > window.width / 2 || height < window.sill || height > window.top)
      return false;
    if (geometry.canopy.visible && direction.y > 1e-10) {
      const canopyT = (floor + window.top - origin.y) / direction.y;
      const z = origin.z + canopyT * direction.z;
      if (canopyT > 0 && z <= facade && z >= facade - geometry.canopy.depth) return false;
    }
    const denominator = c * direction.y - s * direction.z;
    if (Math.abs(denominator) < 1e-10) return true;
    for (const blade of geometry.blades) {
      const bladeT =
        (c * (blade.rootHeight + floor - origin.y) - s * (facade - origin.z)) / denominator;
      if (bladeT <= 0) continue;
      const along =
        -(origin.y + bladeT * direction.y - blade.rootHeight - floor) * s -
        (origin.z + bladeT * direction.z - facade) * c;
      if (along >= 0 && along <= room.slat_chord_m) return false;
    }
    return true;
  };
}
