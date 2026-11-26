import * as T from 'three';
import { finishes, type Finish } from './surfaceSamples';

type Channels = { map: T.DataTexture; relief: T.DataTexture };
const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
function texture(data: Uint8Array, size: number, name: string, color: boolean, anisotropy: number) {
  const t = new T.DataTexture(data, size, size);
  t.name = name;
  t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.LinearFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}
function bake(kind: Finish, anisotropy: number): Channels {
  const recipe = finishes[kind],
    size = recipe.size;
  const albedo = new Uint8Array(size * size * 4),
    relief = new Uint8Array(albedo.length);
  const [red, green, blue] = recipe.rgb;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [tone, rough, height] = recipe.sample((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      albedo[i] = byte(red + tone);
      albedo[i + 1] = byte(green + tone * 0.95);
      albedo[i + 2] = byte(blue + tone * 0.86);
      albedo[i + 3] = 255;
      // Three reads bump from R and roughness from G. Both share a linear texture and the same mip pyramid.
      relief[i] = byte(height * 255);
      relief[i + 1] = byte(rough * 255);
      relief[i + 3] = 255;
    }
  const map = texture(albedo, size, kind + ' color', true, anisotropy);
  const detail = texture(relief, size, kind + ' relief', false, anisotropy);
  for (const t of [map, detail]) t.repeat.set(1 / recipe.width, 1 / recipe.length);
  return { map, relief: detail };
}

/** Board widths and joints live on the room-scale map. Pores are sampled on a second metric UV set. */
function bakeBoards(width: number, depth: number, pores: Channels, anisotropy: number) {
  const size = 1024,
    albedo = new Uint8Array(size * size * 4),
    finish = new Uint8Array(albedo.length);
  const grain = pores.map.image.data as Uint8Array,
    relief = pores.relief.image.data as Uint8Array;
  const tileSize = finishes.oakPores.size,
    boardWidth = 0.18,
    cols = Math.ceil(width / boardWidth);
  let seed = 1237;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let col = 0; col < cols; col++) {
    const xStart = Math.round(((col * boardWidth) / width) * size),
      xEnd = Math.min(size, Math.round((((col + 1) * boardWidth) / width) * size));
    let start = -random() * 1.55;
    while (start < depth) {
      const end = start + 1.4 + random() * 0.8,
        tone = (random() - 0.5) * 20,
        offsetU = random(),
        offsetV = random(),
        tilt = (random() - 0.5) * 0.085;
      const yStart = Math.max(0, Math.round((start / depth) * size)),
        yEnd = Math.min(size, Math.round((end / depth) * size));
      for (let y = yStart; y < yEnd; y++) {
        const along = ((y + 0.5) / size) * depth - start;
        const ty = Math.floor((offsetV + along / 1.46) * tileSize) & (tileSize - 1);
        const bend = 0.021 * Math.sin(along * 3 + offsetU * 8) + tilt * along;
        for (let x = xStart; x < xEnd; x++) {
          const across = ((x + 0.5) / size) * width - col * boardWidth;
          const tx = Math.floor((offsetU + across / 0.32 + bend) * tileSize) & (tileSize - 1);
          const j = (ty * tileSize + tx) * 4,
            i = (y * size + x) * 4;
          const seam = Math.max(
            0,
            1 - Math.max(0, Math.min(across, boardWidth - across, along, end - start)) / 0.005,
          );
          const figure = (grain[j] - 227) * 1.18 + tone;
          albedo[i] = byte(202 + figure - 38 * seam);
          albedo[i + 1] = byte(177 + figure * 0.91 - 34 * seam);
          albedo[i + 2] = byte(141 + figure * 0.77 - 27 * seam);
          albedo[i + 3] = 255;
          finish[i + 1] = byte(relief[j + 1] * 0.93 + 18 + seam * 45);
          finish[i + 3] = 255;
        }
      }
      start = end;
    }
  }
  const map = texture(albedo, size, 'oak boards', true, anisotropy),
    roughnessMap = texture(finish, size, 'board finish', false, anisotropy);
  return { map, roughnessMap };
}

export function materialTextures(maxAnisotropy: number) {
  const anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  const tiles = new Map<Finish, Channels>(),
    floorTextures: T.Texture[] = [];
  function tile(kind: Finish) {
    let cached = tiles.get(kind);
    if (!cached) {
      cached = bake(kind, anisotropy);
      tiles.set(kind, cached);
    }
    return cached;
  }
  function apply(material: T.MeshStandardMaterial, kind: Finish) {
    const { map, relief } = tile(kind);
    material.map = map;
    material.bumpMap = relief;
    material.roughnessMap = relief;
    material.bumpScale = finishes[kind].bump;
  }
  function floor(width: number, depth: number) {
    const micro = tile('oakPores');
    const { map, roughnessMap } = bakeBoards(width, depth, micro, anisotropy);
    const bumpMap = micro.relief.clone();
    bumpMap.channel = 1;
    floorTextures.push(map, roughnessMap, bumpMap);
    return new T.MeshStandardMaterial({
      map,
      roughnessMap,
      bumpMap,
      bumpScale: finishes.oakPores.bump,
      roughness: 1,
    });
  }
  return {
    apply,
    floor,
    dispose() {
      for (const { map, relief } of tiles.values()) {
        map.dispose();
        relief.dispose();
      }
      for (const t of floorTextures) t.dispose();
      tiles.clear();
    },
  };
}
