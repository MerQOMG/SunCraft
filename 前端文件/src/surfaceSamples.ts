/** A tile sample supplies an sRGB tone offset, linear roughness and relative height. */
export type FinishSample = readonly [tone: number, roughness: number, height: number];
type Sampler = (u: number, v: number) => FinishSample;
const tau = 2 * Math.PI;
const seeds = new Uint8Array(256 * 256);
let state = 87123;
for (let i = 0; i < seeds.length; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  seeds[i] = state >>> 24;
}
const wrap = (i: number, length: number) => ((i % length) + length) % length;
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lattice = (x: number, y: number) => seeds[((y & 255) << 8) + (x & 255)] / 127.5 - 1;

/** Periodic value noise. In particular, the last texel blends into the first under mip filtering. */
function noise(u: number, v: number, nx: number, ny = nx) {
  const x = u * nx,
    y = v * ny;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const x0 = wrap(ix, nx),
    x1 = (x0 + 1) % nx,
    y0 = wrap(iy, ny),
    y1 = (y0 + 1) % ny;
  const fx = smooth(x - ix),
    fy = smooth(y - iy);
  return mix(
    mix(lattice(x0, y0), lattice(x1, y0), fx),
    mix(lattice(x0, y1), lattice(x1, y1), fx),
    fy,
  );
}
export function woodFigure(u: number, v: number): FinishSample {
  const sweep = 0.5 + 0.5 * Math.cos(tau * v);
  const bend =
    0.043 * noise(u, v, 4, 3) +
    0.085 * sweep * sweep * Math.cos(tau * u) +
    0.016 * Math.sin(tau * v);
  const across = u + bend;
  const growth = Math.cos(tau * (across * 8 + 0.32 * noise(u, v, 3, 2)));
  const latewood = Math.pow((growth + 1) * 0.5, 5);
  const fibre = noise(across, v, 110, 12),
    pore = Math.max(0, noise(across, v, 155, 38) - 0.18);
  return [
    8 * noise(across, v, 13, 3) + 5 * fibre - 14 * latewood - 10 * pore,
    0.46 + 0.09 * latewood + 0.06 * fibre + 0.13 * pore,
    0.58 - 0.13 * latewood - 0.38 * pore,
  ];
}
/** The lower three quarters show the longitudinal cut, the upper quarter the end of the same timber. */
function walnut(u: number, v: number): FinishSample {
  if (v < 0.75) {
    const [tone, rough, height] = woodFigure(u, v / 0.75);
    return [0.8 * tone, 0.22 + 0.79 * rough, height];
  }
  const cross = (v - 0.875) * 4;
  // Eccentric growth rings interrupted by open pores. The heart is generally outside the board.
  const radius =
    Math.hypot(0.7 + 0.16 * Math.sin(tau * u), cross + 0.28) + 0.012 * noise(u, v, 8, 10);
  const ring = Math.pow(0.5 + 0.5 * Math.cos(tau * radius * 27), 5),
    pore = Math.max(0, noise(u, v, 133, 93) - 0.25);
  return [
    -4 - 6 * ring - 7 * pore + 3 * noise(u, v, 20, 8),
    0.63 + 0.06 * ring + 0.08 * pore,
    0.54 - 0.18 * pore - 0.06 * ring,
  ];
}
function weave(warpCount: number, weftCount: number, contrast: number): Sampler {
  return (u, v) => {
    const x = u * warpCount + 0.18 * noise(u, v, 7, 4),
      y = v * weftCount + 0.15 * noise(u, v, 3, 9);
    // Alternating over/under intersections, with slubs and varying yarn thickness.
    const warp = 0.5 + 0.5 * Math.cos(tau * x),
      weft = 0.5 + 0.5 * Math.cos(tau * y);
    const over = 0.5 + 0.5 * Math.cos(Math.PI * x) * Math.cos(Math.PI * y);
    const yarn = mix(warp * (0.6 + 0.4 * weft), weft * (0.6 + 0.4 * warp), over);
    const slub = noise(u, v, warpCount, 6) * 0.6 + noise(u, v, 8, weftCount) * 0.4;
    const dye = noise(u, v, 6, 9) + 0.45 * noise(u, v, 21, 5);
    return [
      contrast * (yarn - 0.42) + 6 * slub + 4 * dye,
      0.91 - 0.12 * yarn + 0.035 * slub,
      0.24 + 0.56 * yarn + 0.1 * slub,
    ];
  };
}
function nap(u: number, v: number, directional: boolean): FinishSample {
  const tufts = noise(u, v, 17, 13),
    field = noise(u, v, 5, 4);
  const hairs = noise(u + 0.025 * tufts, v, directional ? 100 : 67, directional ? 18 : 49);
  const flecks = Math.max(0, hairs - 0.3);
  const fieldTone = directional ? 6 : 3.5;
  // Broken twill on the woven throw. The pile of the floor rug has no directional chevrons.
  const twill = directional
    ? Math.cos(tau * (32 * v + 2 * Math.abs(2 * (u * 6 - Math.floor(u * 6)) - 1) + 0.16 * tufts))
    : 0;
  return [
    fieldTone * field + 5 * tufts + 8 * hairs + 5 * flecks + 5 * twill,
    0.91 - 0.035 * field - 0.045 * hairs - 0.025 * twill,
    0.49 + 0.12 * tufts + 0.2 * hairs + 0.085 * twill,
  ];
}
function grain(coarse: number, fine: number, roughness: number, variation: number): Sampler {
  return (u, v) => {
    const cloud = noise(u, v, coarse),
      grit = noise(u + 0.07, v + 0.23, fine);
    return [
      variation * (0.54 * cloud + 0.46 * grit),
      roughness + 0.045 * grit + 0.025 * cloud,
      0.5 + 0.28 * grit + 0.08 * cloud,
    ];
  };
}
function leaf(u: number, v: number): FinishSample {
  const mid = Math.abs(u - 0.5) * 2;
  // Follow the four secondary veins of the mesh, with a finer network between them.
  const row = (v - 0.16 - 0.165 * mid) / 0.135,
    nearest = Math.round(row);
  const rib =
    nearest >= 1 && nearest <= 4 && mid < 0.88 ? Math.exp(-370 * (row - nearest) ** 2) : 0;
  const cells = Math.exp(-42 * Math.sin(Math.PI * (3.1 * row + 1.4 * mid)) ** 2);
  const vein = 0.65 * rib + 0.22 * cells + 0.55 * Math.exp(-1800 * mid * mid);
  const tissue = noise(u, v, 12, 19),
    wax = noise(u, v, 4, 5);
  return [
    7 * tissue + 6 * wax + 13 * vein - 5 * mid,
    0.61 + 0.055 * tissue + 0.1 * vein,
    0.46 + 0.07 * tissue + 0.23 * vein,
  ];
}
function graphite(u: number, v: number): FinishSample {
  const grain = noise(u, v, 235, 189),
    mould = noise(u, v, 4, 5);
  // Integral texture of a moulded rear cover. A shallow ribbed band breaks the large dark plane.
  const rib = Math.pow(0.5 + 0.5 * Math.cos(tau * u * 92), 4);
  const band =
    smooth(Math.min(1, Math.max(0, (v - 0.15) / 0.035))) *
    smooth(Math.min(1, Math.max(0, (0.29 - v) / 0.035)));
  return [
    2.4 * grain + 1.2 * mould - 9 * band * rib,
    0.69 + 0.035 * grain + 0.055 * band * rib,
    0.54 + 0.065 * grain - 0.18 * band * rib,
  ];
}
const base = (
  rgb: readonly [number, number, number],
  size: number,
  width: number,
  length: number,
  bump: number,
  sample: Sampler,
) => ({ rgb, size, width, length, bump, sample });

// Tile dimensions are metres unless the object has a natural, single-piece UV chart (leaf or TV back).
export const finishes = {
  walnut: base([157, 125, 94], 512, 0.52, 1, 0.00026, walnut),
  oakPores: base([227, 213, 188], 256, 0.16, 0.32, 0.00055, woodFigure),
  plaster: base([233, 228, 217], 512, 1.35, 1.35, 0.00075, (u, v) => {
    const sweep = noise(u, v, 4, 3),
      lime = noise(u + 0.04 * sweep, v, 13, 11),
      sand = noise(u, v, 182);
    return [
      4.8 * sweep + 2.9 * lime + 1.7 * sand,
      0.91 + 0.035 * lime + 0.035 * sand,
      0.5 + 0.09 * lime + 0.28 * sand,
    ];
  }),
  linen: base([239, 230, 213], 256, 0.14, 0.14, 0.0008, weave(38, 32, 34)),
  cushion: base([245, 241, 230], 256, 0.16, 0.16, 0.0011, weave(34, 28, 43)),
  throw: base([237, 237, 225], 256, 0.18, 0.18, 0.0013, (u, v) => nap(u, v, true)),
  rug: base([214, 202, 180], 512, 0.63, 0.63, 0.00085, (u, v) => nap(u, v, false)),
  curtain: base([224, 216, 198], 256, 0.15, 0.2, 0.00065, weave(60, 24, 26)),
  lampCloth: base([247, 234, 203], 128, 0.085, 0.085, 0.00035, weave(28, 20, 18)),
  powder: base([240, 242, 241], 128, 0.09, 0.09, 0.00024, grain(6, 57, 0.54, 8)),
  rubber: base([243, 243, 240], 128, 0.075, 0.075, 0.00016, grain(5, 50, 0.87, 6)),
  brushed: base([237, 240, 238], 128, 0.07, 0.07, 0.0001, (u, v) => {
    const brushing = noise(u, v, 56, 4);
    return [6 * brushing, 0.33 + 0.085 * brushing, 0.5 + 0.18 * brushing];
  }),
  stone: base([219, 213, 199], 256, 0.34, 0.34, 0.00045, grain(9, 98, 0.67, 17)),
  trim: base([236, 231, 217], 128, 0.22, 0.22, 0.00015, grain(4, 57, 0.57, 4)),
  plinth: base([212, 204, 189], 128, 0.18, 0.18, 0.00035, grain(6, 54, 0.8, 8)),
  rear: base([108, 113, 110], 512, 1, 1, 0.00018, graphite),
  leaf: base([235, 240, 211], 128, 1, 1, 0.00035, leaf),
  bark: base([197, 177, 147], 128, 0.1, 0.23, 0.001, (u, v) => {
    const fissure = noise(u + 0.025 * noise(u, v, 3, 3), v, 40, 6);
    return [19 * fissure, 0.83 + 0.08 * fissure, 0.48 + 0.34 * fissure];
  }),
  earth: base([119, 99, 75], 128, 0.1, 0.1, 0.0015, grain(11, 57, 0.96, 31)),
  clay: base([219, 206, 184], 256, 0.24, 0.24, 0.00075, grain(9, 99, 0.84, 16)),
  porcelain: base([243, 240, 229], 128, 0.12, 0.12, 0.00007, grain(6, 44, 0.23, 3)),
  bookCloth: base([245, 239, 224], 128, 0.075, 0.075, 0.00025, weave(30, 24, 20)),
  paper: base([246, 236, 213], 128, 0.12, 0.12, 0.00017, grain(12, 64, 0.91, 9)),
  pages: base([234, 222, 197], 128, 0.12, 0.07, 0.00021, (u, v) => {
    const line = Math.cos(tau * (32 * v + 0.1 * noise(u, v, 3, 8)));
    return [5 * line + 3 * noise(u, v, 12, 36), 0.91 + 0.035 * line, 0.5 + 0.18 * line];
  }),
} as const;
export type Finish = keyof typeof finishes;
