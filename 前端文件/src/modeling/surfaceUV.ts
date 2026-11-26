import * as T from 'three';
import type { Finish } from '../surfaceSamples';

type Mapping = 'metres' | 'wood' | 'original' | 'wrap' | 'rear';
type Surface = { finish: Finish; mapping: Mapping };
export function surfaceOf(material: T.Material): Surface | undefined {
  return material.userData.surface;
}
export function coat<M extends T.MeshStandardMaterial>(
  m: M,
  finish: Finish,
  mapping: Mapping = 'metres',
): M {
  m.userData.surface = { finish, mapping };
  return m;
}
export function finished(
  finish: Finish,
  tint: T.ColorRepresentation = 0xffffff,
  name: string = finish,
  mapping: Mapping = 'metres',
  extra: T.MeshStandardMaterialParameters = {},
) {
  const m = coat(
    new T.MeshStandardMaterial({ roughness: 1, color: tint, ...extra }),
    finish,
    mapping,
  );
  m.name = name;
  return m;
}

const origin = new T.Vector3(),
  unit = new T.Vector3(1, 1, 1);
export function metricUV(g: T.BufferGeometry, offset = origin, scale = unit) {
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  if (!uv || !p) return g;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * scale.x + offset.x,
      y = p.getY(i) * scale.y + offset.y,
      z = p.getZ(i) * scale.z + offset.z;
    const ax = Math.abs(n?.getX(i) ?? 0),
      ay = Math.abs(n?.getY(i) ?? 1),
      az = Math.abs(n?.getZ(i) ?? 0);
    if (ay >= ax && ay >= az) uv.setXY(i, x, z);
    else if (ax >= az) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return g;
}
const size = new T.Vector3(),
  center = new T.Vector3();
export function mapPart(g: T.BufferGeometry, material: T.Material) {
  const surface = surfaceOf(material);
  if (!surface || surface.mapping === 'original') return;
  if (surface.mapping === 'metres') {
    metricUV(g);
    return;
  }
  g.computeBoundingBox();
  g.boundingBox!.getSize(size);
  g.boundingBox!.getCenter(center);
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  if (surface.mapping === 'wrap') {
    // Native lathe and cylinder UVs follow the circumference without a stretched side projection.
    const circumference = Math.PI * Math.max(size.x, size.z);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circumference, uv.getY(i) * size.y);
  } else if (surface.mapping === 'rear') {
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (p.getZ(i) - center.z) / size.z + 0.5, (p.getY(i) - center.y) / size.y + 0.5);
  } else {
    // Before batching, orient every timber part independently. End faces cut across annual rings.
    const axis = size.y > size.z && size.y > size.x ? 'y' : size.x > size.z ? 'x' : 'z';
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - center.x,
        y = p.getY(i) - center.y,
        z = p.getZ(i) - center.z;
      const along = axis === 'y' ? y : axis === 'x' ? x : z;
      const a = axis === 'x' ? z : x,
        b = axis === 'y' ? z : y;
      const end = Math.abs(axis === 'y' ? n.getY(i) : axis === 'x' ? n.getX(i) : n.getZ(i));
      const broadFace = Math.abs(axis === 'y' ? n.getZ(i) : n.getY(i));
      if (end > 0.85) {
        const crossSize = axis === 'y' ? size.z : size.y;
        uv.setXY(i, a, 0.875 + (0.2 * b) / Math.max(0.35, crossSize));
      } else {
        const across = broadFace > 0.6 ? a : b;
        uv.setXY(i, across, 0.375 + along / Math.max(3.6, size[axis] * 1.55));
      }
    }
  }
  uv.needsUpdate = true;
}
