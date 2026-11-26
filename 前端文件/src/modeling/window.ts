import { finished, mapPart, metricUV } from './surfaceUV';
import * as T from 'three';
import { Assembly, rectangle } from './construction.ts';
import { VISUAL_CONSTRUCTION } from '../shading';
import { RENDER_FLOOR_Y } from '../geometry';
import type { RoomGeometry, shadeGeometry } from '../geometry';
/** A two-chamber aluminium extrusion; length may change, cross-section never scales. */
function profile(length: number, width: number, depth: number, axis: 'x' | 'y') {
  const s = rectangle(width, depth, 0.002);
  for (const sign of [-1, 1]) {
    const hole = new T.Path();
    const x = -width / 2 + 0.006,
      y = sign * depth * 0.25 - depth * 0.18;
    hole.moveTo(x, y);
    hole.lineTo(x, y + depth * 0.36);
    hole.lineTo(-x, y + depth * 0.36);
    hole.lineTo(-x, y);
    hole.closePath();
    s.holes.push(hole);
  }
  const g = new T.ExtrudeGeometry(s, {
    depth: length,
    bevelEnabled: false,
    curveSegments: 4,
    steps: 1,
  });
  g.translate(0, 0, -length / 2);
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  else {
    g.rotateY(Math.PI / 2);
    g.rotateX(Math.PI / 2);
  }
  return g;
}
export function fineWindow(room: RoomGeometry) {
  const w = room.window_width_m,
    f = RENDER_FLOOR_Y,
    facade = -room.depth_m / 2,
    capacity = Math.ceil((room.height_m - room.sill_m) / room.slat_pitch_m);
  const group = new T.Group();
  group.name = 'window-profile-and-hardware';
  const metal = finished('powder', '#737b76', 'powdercoated-aluminium', 'metres', {
      metalness: 0.09,
    }),
    gasket = finished('rubber', '#424a44', 'EPDM-seals'),
    screw = finished('brushed', '#b5b8b0', 'stainless-fasteners', 'metres', { metalness: 0.88 }),
    sillMat = finished('stone', 0xffffff, 'honed-stone-sill');
  const horizontal = [
    new T.Mesh(profile(w + 0.1, 0.055, 0.1, 'x'), metal),
    new T.Mesh(profile(w + 0.1, 0.055, 0.1, 'x'), metal),
  ];
  horizontal.forEach((m) => {
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  });
  const vertical = [-w / 2, w / 2, -w / 6, w / 6].map((x, i) => {
    const m = new T.Mesh(profile(1, i < 2 ? 0.055 : 0.035, i < 2 ? 0.1 : 0.07, 'y'), metal);
    m.position.set(x, room.height_m / 2 + f, facade);
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
    return m;
  });
  const innerH = [
    new T.Mesh(new T.BoxGeometry(w - 0.03, 0.006, 0.012), gasket),
    new T.Mesh(new T.BoxGeometry(w - 0.03, 0.006, 0.012), gasket),
  ];
  innerH.forEach((m) => {
    m.castShadow = false;
    group.add(m);
  });
  const innerV = [-w / 2 + 0.03, w / 2 - 0.03, -w / 6 + 0.02, w / 6 - 0.02].map((x) => {
    const m = new T.Mesh(new T.BoxGeometry(0.004, 1, 0.014), gasket);
    m.position.set(x, room.height_m / 2 + f, facade + 0.051);
    group.add(m);
    return m;
  });
  const a = new Assembly();
  for (const side of [-1, 1]) {
    a.box(
      0.036,
      room.height_m - 0.1,
      0.055,
      side * (w / 2 + 0.045),
      room.height_m / 2 + f,
      facade - 0.19,
      metal,
      0.005,
    );
    // Anchored side track: wall shoe, return flange and screw heads are joined, not floating.
    for (const yy of [
      0.093333 * room.height_m + f,
      room.height_m / 2 + f,
      0.906667 * room.height_m + f,
    ]) {
      a.box(0.06, 0.065, 0.11, side * (w / 2 + 0.055), yy, facade - 0.12, metal, 0.003);
      a.add(
        new T.CylinderGeometry(0.006, 0.006, 0.004, 12),
        screw,
        new T.Vector3(side * (w / 2 + 0.052), yy, facade - 0.062),
        new T.Euler(Math.PI / 2, 0, 0),
      );
    }
  }
  const fixed = a.finish('shade-mounts');
  fixed.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = false;
  });
  group.add(fixed);
  const pins = new T.InstancedMesh(
    new T.CylinderGeometry(0.009, 0.009, 0.045, 12),
    screw,
    capacity * 2,
  );
  pins.name = 'variable-blade-pivot-pins';
  pins.castShadow = false;
  pins.receiveShadow = true;
  group.add(pins);
  const endCaps = new T.InstancedMesh(
    new T.BoxGeometry(0.009, VISUAL_CONSTRUCTION.bladeThickness_m * 0.93, room.slat_chord_m * 0.94),
    metal,
    capacity * 2,
  );
  endCaps.name = 'variable-blade-end-caps';
  endCaps.castShadow = false;
  endCaps.receiveShadow = true;
  group.add(endCaps);
  const sill = new T.Mesh(new T.BoxGeometry(w + 0.17, 0.014, 0.36), sillMat);
  sill.castShadow = false;
  sill.receiveShadow = true;
  group.add(sill);
  const drip = new T.Mesh(new T.BoxGeometry(w, 0.004, 0.004), gasket);
  drip.castShadow = false;
  group.add(drip);
  for (const part of [...horizontal, ...vertical, ...innerH, ...innerV, pins, endCaps, sill, drip])
    mapPart(part.geometry, part.material);
  let mappedHeight = -1;
  const update = (g: ReturnType<typeof shadeGeometry>) => {
    const win = g.window,
      angle = -g.angle;
    horizontal[0].position.set(0, win.top + f, -room.depth_m / 2);
    horizontal[1].position.set(0, win.sill + f, -room.depth_m / 2);
    vertical.forEach((m) => {
      m.scale.y = win.height;
      m.position.y = win.center + f;
    });
    innerH[0].position.set(0, win.top + f - 0.029, -room.depth_m / 2 + 0.054);
    innerH[1].position.set(0, win.sill + f + 0.029, -room.depth_m / 2 + 0.054);
    innerV.forEach((m) => {
      m.scale.y = Math.max(0.1, win.height - 0.06);
      m.position.y = win.center + f;
    });
    if (win.height !== mappedHeight) {
      for (const part of [...vertical, ...innerV])
        metricUV(part.geometry, part.position, part.scale);
      mappedHeight = win.height;
    }
    sill.position.set(0, win.sill + f - 0.004, -room.depth_m / 2 + 0.05);
    drip.position.set(0, win.sill + f - 0.059, -room.depth_m / 2 + 0.19);
    pins.count = endCaps.count = g.blades.length * 2;
    for (let i = 0; i < g.blades.length; i++)
      for (let side = 0; side < 2; side++) {
        const b = g.blades[i],
          at = i * 2 + side,
          xx = side === 0 ? -w / 2 : w / 2;
        pins.setMatrixAt(
          at,
          new T.Matrix4().compose(
            new T.Vector3(xx, b.rootHeight + f, -room.depth_m / 2),
            new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)),
            new T.Vector3(1, 1, 1),
          ),
        );
        endCaps.setMatrixAt(
          at,
          new T.Matrix4().compose(
            new T.Vector3(xx * 0.998, b.centerHeight + f, -room.depth_m / 2 + b.centerDepth),
            new T.Quaternion().setFromEuler(new T.Euler(angle, 0, 0)),
            new T.Vector3(1, 1, 1),
          ),
        );
      }
    pins.instanceMatrix.needsUpdate = endCaps.instanceMatrix.needsUpdate = true;
    pins.computeBoundingSphere();
    endCaps.computeBoundingSphere();
  };
  return { group, update };
}
