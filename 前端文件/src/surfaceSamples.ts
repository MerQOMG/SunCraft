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
const wrap = (i: number, length: number) => (i % length + length) % length;
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lattice = (x: number, y: number) => seeds[((y & 255) << 8) + (x & 255)] / 127.5 - 1;

/** Periodic value noise. In particular, the last texel blends into the first under mip filtering. */
function noise(u: number, v: number, nx: number, ny = nx) {
  const x = u * nx, y = v * ny;
  const ix = Math.floor(x), iy = Math.floor(y);
  const x0 = wrap(ix, nx), x1 = (x0 + 1) % nx, y0 = wrap(iy, ny), y1 = (y0 + 1) % ny;
  const fx = smooth(x - ix), fy = smooth(y - iy);
  return mix(mix(lattice(x0,y0), lattice(x1,y0), fx), mix(lattice(x0,y1), lattice(x1,y1), fx), fy);
}
export function woodFigure(u: number, v: number): FinishSample {
  const sweep=.5+.5*Math.cos(tau*v);
  const bend = .043*noise(u,v,4,3) + .085*sweep*sweep*Math.cos(tau*u) + .016*Math.sin(tau*v);
  const across = u + bend;
  const growth = Math.cos(tau * (across*8 + .32*noise(u,v,3,2)));
  const latewood = Math.pow((growth+1)*.5, 5);
  const fibre = noise(across,v,110,12), pore = Math.max(0,noise(across,v,155,38)-.18);
  return [8*noise(across,v,13,3) + 5*fibre - 14*latewood - 10*pore,
    .46 + .09*latewood + .06*fibre + .13*pore, .58 - .13*latewood - .38*pore];
}
/** The lower three quarters show the longitudinal cut, the upper quarter the end of the same timber. */
function walnut(u: number, v: number): FinishSample {
  if (v < .75) {
    const [tone,rough,height]=woodFigure(u,v/.75);
    return [.80*tone, .22+.79*rough, height];
  }
  const cross=(v-.875)*4;
  // Eccentric growth rings interrupted by open pores. The heart is generally outside the board.
  const radius=Math.hypot(.70+.16*Math.sin(tau*u),cross+.28)+.012*noise(u,v,8,10);
  const ring=Math.pow(.5+.5*Math.cos(tau*radius*27),5), pore=Math.max(0,noise(u,v,133,93)-.25);
  return [-4-6*ring-7*pore+3*noise(u,v,20,8),.63+.06*ring+.08*pore,.54-.18*pore-.06*ring];
}
function weave(warpCount: number, weftCount: number, contrast: number): Sampler {
  return (u,v) => {
    const x = u*warpCount + .18*noise(u,v,7,4), y = v*weftCount + .15*noise(u,v,3,9);
    // Alternating over/under intersections, with slubs and varying yarn thickness.
    const warp = .5+.5*Math.cos(tau*x), weft = .5+.5*Math.cos(tau*y);
    const over = .5+.5*Math.cos(Math.PI*x)*Math.cos(Math.PI*y);
    const yarn = mix(warp*(.6+.4*weft), weft*(.6+.4*warp),over);
    const slub = noise(u,v,warpCount,6)*.6 + noise(u,v,8,weftCount)*.4;
    const dye = noise(u,v,6,9) + .45*noise(u,v,21,5);
    return [contrast*(yarn-.42)+6*slub+4*dye, .91-.12*yarn+.035*slub, .24+.56*yarn+.1*slub];
  };
}
function nap(u: number, v: number, directional: boolean): FinishSample {
  const tufts = noise(u,v,17,13), field = noise(u,v,5,4);
  const hairs = noise(u+.025*tufts,v,directional?100:67,directional?18:49);
  const flecks = Math.max(0,hairs-.3);
  const fieldTone=directional?6:3.5;
  // Broken twill on the woven throw. The pile of the floor rug has no directional chevrons.
  const twill=directional?Math.cos(tau*(32*v+2*Math.abs(2*(u*6-Math.floor(u*6))-1)+.16*tufts)):0;
  return [fieldTone*field+5*tufts+8*hairs+5*flecks+5*twill,.91-.035*field-.045*hairs-.025*twill,.49+.12*tufts+.20*hairs+.085*twill];
}
function grain(coarse: number, fine: number, roughness: number, variation: number): Sampler {
  return (u,v) => {
    const cloud = noise(u,v,coarse), grit = noise(u+.07,v+.23,fine);
    return [variation*(.54*cloud+.46*grit), roughness+.045*grit+.025*cloud, .5+.28*grit+.08*cloud];
  };
}
function leaf(u: number, v: number): FinishSample {
  const mid = Math.abs(u-.5)*2;
  // Follow the four secondary veins of the mesh, with a finer network between them.
  const row=(v-.16-.165*mid)/.135, nearest=Math.round(row);
  const rib=(nearest>=1 && nearest<=4 && mid<.88)?Math.exp(-370*(row-nearest)**2):0;
  const cells=Math.exp(-42*Math.sin(Math.PI*(3.1*row+1.4*mid))**2);
  const vein=.65*rib+.22*cells+.55*Math.exp(-1800*mid*mid);
  const tissue = noise(u,v,12,19), wax = noise(u,v,4,5);
  return [7*tissue+6*wax+13*vein-5*mid,.61+.055*tissue+.10*vein,.46+.07*tissue+.23*vein];
}
function graphite(u: number,v: number): FinishSample {
  const grain = noise(u,v,235,189), mould = noise(u,v,4,5);
  // Integral texture of a moulded rear cover. A shallow ribbed band breaks the large dark plane.
  const rib = Math.pow(.5+.5*Math.cos(tau*u*92),4);
  const band = smooth(Math.min(1,Math.max(0,(v-.15)/.035)))*smooth(Math.min(1,Math.max(0,(.29-v)/.035)));
  return [2.4*grain+1.2*mould-9*band*rib,.69+.035*grain+.055*band*rib,.54+.065*grain-.18*band*rib];
}
const base = (rgb: readonly [number,number,number], size: number, width: number, length: number,
              bump: number, sample: Sampler) => ({rgb,size,width,length,bump,sample});

// Tile dimensions are metres unless the object has a natural, single-piece UV chart (leaf or TV back).
export const finishes = {
  walnut: base([157,125,94],512,.52,1,.00026,walnut),
  oakPores: base([227,213,188],256,.16,.32,.00055,woodFigure),
  plaster: base([233,228,217],512,1.35,1.35,.00075,(u,v)=>{
    const sweep=noise(u,v,4,3), lime=noise(u+.04*sweep,v,13,11), sand=noise(u,v,182);
    return [4.8*sweep+2.9*lime+1.7*sand,.91+.035*lime+.035*sand,.5+.09*lime+.28*sand];
  }),
  linen: base([239,230,213],256,.14,.14,.0008,weave(38,32,34)),
  cushion: base([245,241,230],256,.16,.16,.0011,weave(34,28,43)),
  throw: base([237,237,225],256,.18,.18,.0013,(u,v)=>nap(u,v,true)),
  rug: base([214,202,180],512,.63,.63,.00085,(u,v)=>nap(u,v,false)),
  curtain: base([224,216,198],256,.15,.20,.00065,weave(60,24,26)),
  lampCloth: base([247,234,203],128,.085,.085,.00035,weave(28,20,18)),
  powder: base([240,242,241],128,.09,.09,.00024,grain(6,57,.54,8)),
  rubber: base([243,243,240],128,.075,.075,.00016,grain(5,50,.87,6)),
  brushed: base([237,240,238],128,.07,.07,.00010,(u,v)=>{
    const brushing=noise(u,v,56,4);
    return [6*brushing,.33+.085*brushing,.5+.18*brushing];
  }),
  stone: base([219,213,199],256,.34,.34,.00045,grain(9,98,.67,17)),
  trim: base([236,231,217],128,.22,.22,.00015,grain(4,57,.57,4)),
  plinth: base([212,204,189],128,.18,.18,.00035,grain(6,54,.80,8)),
  rear: base([108,113,110],512,1,1,.00018,graphite),
  leaf: base([235,240,211],128,1,1,.00035,leaf),
  bark: base([197,177,147],128,.10,.23,.0010,(u,v)=>{
    const fissure=noise(u+.025*noise(u,v,3,3),v,40,6);
    return [19*fissure,.83+.08*fissure,.48+.34*fissure];
  }),
  earth: base([119,99,75],128,.10,.10,.0015,grain(11,57,.96,31)),
  clay: base([219,206,184],256,.24,.24,.00075,grain(9,99,.84,16)),
  porcelain: base([243,240,229],128,.12,.12,.00007,grain(6,44,.23,3)),
  bookCloth: base([245,239,224],128,.075,.075,.00025,weave(30,24,20)),
  paper: base([246,236,213],128,.12,.12,.00017,grain(12,64,.91,9)),
  pages: base([234,222,197],128,.12,.07,.00021,(u,v)=>{
    const line = Math.cos(tau*(32*v+.10*noise(u,v,3,8)));
    return [5*line+3*noise(u,v,12,36),.91+.035*line,.5+.18*line];
  }),
} as const;
export type Finish = keyof typeof finishes;
