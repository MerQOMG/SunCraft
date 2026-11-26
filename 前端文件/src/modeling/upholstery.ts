import * as T from 'three';
import { seatOffset } from './construction.ts';
/** Local sofa coordinates; support is an ergonomic 43 cm above the finished floor. */
export const SEAT = {
  width: 0.85,
  height: 0.136,
  depth: 0.86,
  x: -1.865,
  y: 0.41,
  z: 1.35,
  radius: 0.028,
  crown: 0.011,
  hollow: 0.012,
} as const;
export function seatTopAt(x: number, z: number) {
  const dx = x - SEAT.x,
    dz = z - SEAT.z,
    r = SEAT.radius;
  const top =
    SEAT.height / 2 -
    r +
    Math.sqrt(
      Math.max(
        0,
        r * r -
          Math.max(0, Math.abs(dx) - (SEAT.width / 2 - r)) ** 2 -
          Math.max(0, Math.abs(dz) - (SEAT.depth / 2 - r)) ** 2,
      ),
    );
  return SEAT.y + top + seatOffset(dx / (SEAT.width / 2), dz / (SEAT.depth / 2), SEAT);
}
/** Hand-modelled gravity drape, not a cloth solver. Surface contact → rounded turn → hanging folds. */
export function throwPoint(u: number, t: number) {
  const z = 1.32 + u * 0.64 + 0.018 * Math.sin(t * Math.PI) * Math.sin(u * 3 * Math.PI);
  const ridgeA = Math.exp(-Math.pow((u + 0.23 + 0.045 * Math.sin(t * 4)) / 0.075, 2)),
    ridgeB = Math.exp(-Math.pow((u - 0.14 - 0.045 * Math.sin(t * 7)) / 0.1, 2));
  const wave = 0.9 * ridgeA + 0.72 * ridgeB + 0.18 * (0.5 + 0.5 * Math.sin(u * 25 + t * 7));
  const fold = 0.0018 + (0.004 + 0.028 * T.MathUtils.smoothstep(t, 0.4, 1)) * wave;
  const x0 = -1.468,
    r = 0.028,
    top = seatTopAt(x0, z);
  if (t <= 0.57) {
    const x = -2.13 + ((x0 + 2.13) * t) / 0.57;
    return new T.Vector3(x, seatTopAt(x, z) + fold, z);
  }
  if (t <= 0.74) {
    const a = (((t - 0.57) / 0.17) * Math.PI) / 2;
    return new T.Vector3(x0 + (r + fold) * Math.sin(a), top - r + (r + fold) * Math.cos(a), z);
  }
  const v = (t - 0.74) / 0.26,
    hem = 0.24 + 0.036 * u + 0.015 * Math.sin(u * 8) + 0.006 * Math.cos(u * 15);
  return new T.Vector3(
    x0 + r + fold + 0.01 * v + 0.016 * Math.sin(Math.PI * v),
    top - r - v * hem + 0.005 * Math.sin(u * 14 + v * 4) * Math.sin(v * Math.PI),
    z,
  );
}
export function throwGeometry() {
  const g = new T.PlaneGeometry(1, 1, 48, 72),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const q = throwPoint(p.getX(i), p.getY(i) + 0.5);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  g.computeVertexNormals();
  return g;
}
