import { Color, SRGBColorSpace } from 'three';
/** Presentation only: original absolute DF-percent palette, never per-grid normalization. */
export const HEATMAP_MAX_PERCENT = 5;
export function heatmapColor(value: number) {
  return `#${new Color().setHSL((1 - Math.min(value / HEATMAP_MAX_PERCENT, 1)) * 0.65, 0.75, 0.53).getHexString(SRGBColorSpace)}`;
}
export const HEATMAP_GRADIENT = `linear-gradient(90deg,${Array.from({ length: 21 }, (_, i) => `${heatmapColor((i * HEATMAP_MAX_PERCENT) / 20)} ${i * 5}%`).join(',')})`;
/** Fixed logarithmic scale keeps diffuse-only cells visible without normalizing
 * each date to its own maximum. The same number always means the same color. */
export function dateHeatmapColor(value: number) {
  const progress = Math.log1p(Math.min(100, Math.max(0, value))) / Math.log(101);
  return `#${new Color().setHSL((1 - progress) * 0.65, 0.75, 0.53).getHexString(SRGBColorSpace)}`;
}
export const DATE_HEATMAP_GRADIENT = `linear-gradient(90deg,${[0, 1, 5, 20, 100].map((value) => `${dateHeatmapColor(value)} ${(Math.log1p(value) / Math.log(101)) * 100}%`).join(',')})`;
export function showCurrentHeat(requested: boolean, hasResult: boolean, current: boolean) {
  return requested && hasResult && current;
}
