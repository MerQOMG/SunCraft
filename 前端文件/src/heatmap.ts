import { Color, SRGBColorSpace } from 'three';
/** Presentation only: original absolute DF-percent palette, never per-grid normalization. */
export const HEATMAP_MAX_PERCENT = 5;
export function heatmapColor(value: number) {
  return `#${new Color().setHSL((1 - Math.min(value / HEATMAP_MAX_PERCENT, 1)) * 0.65, 0.75, 0.53).getHexString(SRGBColorSpace)}`;
}
export const HEATMAP_GRADIENT = `linear-gradient(90deg,${Array.from({ length: 21 }, (_, i) => `${heatmapColor((i * HEATMAP_MAX_PERCENT) / 20)} ${i * 5}%`).join(',')})`;
export function showCurrentHeat(requested: boolean, hasResult: boolean, current: boolean) {
  return requested && hasResult && current;
}
