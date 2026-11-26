import {EXAMPLE_ROOM} from '../src/geometry';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {EMPTY_SPATIAL,spatialReducer,spatialTarget,mobileWorkspaceLayout} from '../src/scoring/spatial';
import {EXAMPLE_SCORE_REPORT} from '../src/scoring/example';
import Section from '../src/Section';
import {DimensionAccordion} from '../src/scoring/DimensionAccordion';
import {DEFAULTS,mockSimulate} from '../src/model';
const result=mockSimulate(DEFAULTS),noop=()=>{};
describe('R2 keyboard ownership and reflow-safe linkage',()=>{
 it('keeps focused winter depth through pointer enter/leave caused by scrolling',()=>{let s=spatialReducer(EMPTY_SPATIAL,{type:'focus',key:'winter',target:'winter-depth'});s=spatialReducer(s,{type:'hover',key:'sofa',target:'sofa'});expect(spatialTarget(s)).toBe('winter-depth');s=spatialReducer(s,{type:'leave',key:'sofa'});expect(spatialTarget(s)).toBe('winter-depth')});
 it('ignores stale blur/leave from another owner',()=>{let s=spatialReducer(EMPTY_SPATIAL,{type:'focus',key:'winter',target:'winter-depth'});s=spatialReducer(s,{type:'blur',key:'old-row'});s=spatialReducer(s,{type:'leave',key:'other'});expect(spatialTarget(s)).toBe('winter-depth')});
 it('returns to hover only after the actual focused row blurs, and clears on close',()=>{let s=spatialReducer(EMPTY_SPATIAL,{type:'hover',key:'sofa',target:'sofa'});s=spatialReducer(s,{type:'focus',key:'winter',target:'winter-depth'});s=spatialReducer(s,{type:'blur',key:'winter'});expect(spatialTarget(s)).toBe('sofa');expect(spatialTarget(spatialReducer(s,{type:'clear'}))).toBeNull()});
 it('puts the mobile current-result SVG in its linked row, separate from the fixture value',()=>{const row=EXAMPLE_SCORE_REPORT.dimensions[1],preview=<Section room={EXAMPLE_ROOM} drawingId="inline-test" parameters={DEFAULTS} result={result} season="winter" highlightWinter/>;const markup=renderToStaticMarkup(<DimensionAccordion dimension={row} open onToggle={noop} onSpatialAction={noop} depthPreview={preview}/>);expect(markup).toContain('mobile-depth-preview');expect(markup).toContain('id="inline-test"');expect(markup).toContain(`data-result-depth="${result.svg_rays.winter_hit_depth}"`);expect(markup).toContain('2.72 m（示例）')});
});
describe('R2 non-overlapping mobile instruments (equations, not browser measurement)',()=>{
 it.each([522,675,810])('reserves a full non-overlapping canvas at viewport height %i',height=>{const l=mobileWorkspaceLayout(height);expect(l.canvasHeight).toBeGreaterThanOrEqual(240);expect(l.scoreTop-l.canvasBottom).toBe(10);expect(l.tabsTop-l.scoreBottom).toBe(10);expect(l.panelTop).toBeGreaterThan(l.tabsTop+40)});
 it('ties every mobile control to the same actual clamped canvas boundary',()=>{const css=readFileSync(new URL('../src/scoring/scoring.css',import.meta.url),'utf8');expect(css).toContain('--mobile-scene-height:clamp(240px, calc(47dvh - 100px), 340px)');expect(css).toContain('--mobile-score-top:calc(119px + var(--mobile-scene-height) + 10px)');expect(css).toContain('.scene { height:var(--mobile-scene-height); min-height:0 }');expect(css).toContain('position:absolute; top:calc(var(--mobile-score-top) + 116px); bottom:auto')});
});
describe('R2 actual SVG annotation and PDF mapping',()=>{
 it('uses the exact same depth endpoints and solar paths, with a visible non-scaling result overlay',()=>{const markup=renderToStaticMarkup(<Section room={EXAMPLE_ROOM} parameters={DEFAULTS} result={result} season="winter" highlightWinter/>),end=88+result.svg_rays.winter_hit_depth*38;expect(markup).toContain(`data-highlighted-depth="true" d="M88 204H${end}"`);expect(markup).toContain('stroke-width="3.2"');expect(markup).toContain('vector-effect="non-scaling-stroke"');expect(markup).toContain('data-analysis-annotation="winter-depth"')});
 it('keeps the PDF four dimensions and all ten contribution caps aligned',()=>{expect(EXAMPLE_SCORE_REPORT.dimensions.map(d=>d.items.map(i=>[i.key,i.max_score]))).toEqual([[['summer_shading_rate',20],['wwr_shgc',15]],[['winter_solar_gain_rate',12],['winter_penetration_m',8],['winter_sun_hours',5]],[['daylight_compliance_rate',15],['daylight_uniformity',5],['window_floor_ratio',5]],[['sofa_exposure_hours',8],['carbon_reduction',7]]])});
});
