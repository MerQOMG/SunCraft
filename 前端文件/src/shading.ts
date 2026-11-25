/** Fixed visual construction, not an optimization variable or a change to mock metrics.
 * Seven 100 mm chord / 12 mm thick external metal blades. Angle zero is horizontal,
 * not a promise of zero obstruction (especially under a high summer-noon sun). */
export const LOUVER = {count:7,chord_m:.10,thickness_m:.012,offset_m:.20} as const;
export const FINISH = {floorTop_m:.041,rugThickness_m:.025,rugTop_m:.066,sofaLegTop_m:.245} as const;
export function sofaFoot(onRug:boolean){const bottom=onRug?FINISH.rugTop_m:FINISH.floorTop_m;const height=FINISH.sofaLegTop_m-bottom;return {bottom,height,center:bottom+height/2}}
