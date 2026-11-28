import type { SolarFrame } from './annual';
import type { RoomGeometry } from './geometry';
import { RENDER_FLOOR_Y } from './geometry';
import type { Parameters } from './model';
import { apertureAccess } from './solarAccess';

export type HeatMode = 'date' | 'df';
export const DATE_HEAT_MODEL = {
  glassTransmittance: 0.72,
  diffuseSkyFraction: 0.15,
  subsamples: 3,
} as const;
export interface DateHeatmap {
  date: string;
  grid: number[][];
  directGrid: number[][];
  directAreaFraction: number;
  max: number;
  mean: number;
  southIncident: boolean;
}
/** Relative light on the floor for the selected noon. 100 = unobstructed
 * direct-normal outdoor light; assumed sky fraction is constant clear-sky
 * comparison input. This is neither DF nor measured lux/weather data.
 */
export function dateHeatmap(
  p: Parameters,
  room: RoomGeometry,
  frame: SolarFrame,
  df: number[][],
): DateHeatmap {
  const rows = Math.min(df.length, 64),
    cols = Math.min(df[0].length, 64);
  const access = apertureAccess(p, room),
    n = DATE_HEAT_MODEL.subsamples;
  const altitudeFactor = frame.aboveHorizon ? Math.max(0, frame.direction.y) : 0;
  const southIncident = frame.aboveHorizon && frame.direction.z < -1e-10;
  let directSum = 0,
    total = 0,
    max = 0;
  const directGrid: number[][] = [];
  const grid = Array.from({ length: rows }, (_, z) => {
    const directRow: number[] = [];
    const row = Array.from({ length: cols }, (_, x) => {
      let visible = 0;
      if (southIncident)
        for (let iz = 0; iz < n; iz++)
          for (let ix = 0; ix < n; ix++) {
            const origin = {
              x: ((x + (ix + 0.5) / n) / cols - 0.5) * room.width_m,
              y: RENDER_FLOOR_Y + 0.001,
              z: -room.depth_m / 2 + ((z + (iz + 0.5) / n) * room.depth_m) / rows,
            };
            if (access(origin, frame.direction)) visible++;
          }
      const fraction = visible / (n * n);
      directRow.push(fraction);
      directSum += fraction;
      const sourceZ = Math.min(df.length - 1, Math.floor(((z + 0.5) * df.length) / rows));
      const sourceX = Math.min(df[0].length - 1, Math.floor(((x + 0.5) * df[0].length) / cols));
      const diffuse = df[sourceZ][sourceX] * DATE_HEAT_MODEL.diffuseSkyFraction * altitudeFactor;
      const direct = 100 * DATE_HEAT_MODEL.glassTransmittance * altitudeFactor * fraction;
      const value = Math.min(100, Math.max(0, diffuse + direct));
      total += value;
      max = Math.max(max, value);
      return value;
    });
    directGrid.push(directRow);
    return row;
  });
  return {
    date: frame.date,
    grid,
    directGrid,
    directAreaFraction: directSum / (rows * cols),
    max,
    mean: total / (rows * cols),
    southIncident,
  };
}
