import {EXAMPLE_ROOM} from '../src/geometry';
import {describe,it,expect} from 'vitest';
import {createRef} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,writeFileSync} from 'node:fs';
import {EXAMPLE_SCORE_REPORT as fixture} from '../src/scoring/example';
import {adaptScoreReport,gradeColor} from '../src/scoring/report';
import {validateSimulation,validateOptimization} from '../src/api';
import {DEFAULTS,mockSimulate,mockOptimize} from '../src/model';
import {ScoreCapsule,ScoreDrawer} from '../src/scoring/ScoreDrawer';
import {DimensionAccordion} from '../src/scoring/DimensionAccordion';
import Section from '../src/Section';
const copy=()=>structuredClone(fixture),noop=()=>{};
describe('additive score contract and honest fallbacks',()=>{
 it('has a complete self-consistent four-dimension ten-item independent fixture',()=>{expect(fixture.dimensions.map(d=>d.weight)).toEqual([35,25,25,15]);expect(fixture.dimensions.flatMap(d=>d.items)).toHaveLength(10);expect(fixture.dimensions.reduce((s,d)=>s+d.score!,0)).toBeCloseTo(88.4);expect(fixture.provenance).toBe('example');expect(adaptScoreReport(copy())).toEqual(fixture)});
 it('does not fabricate scores in legacy simulate or optimize responses',()=>{expect(validateSimulation(mockSimulate(DEFAULTS)).score_report).toBeUndefined();expect(validateOptimization(mockOptimize(DEFAULTS),DEFAULTS).after.score_report).toBeUndefined()});
 it('accepts the partial PDF report without inventing the other eight items',()=>{const v=copy();v.dimensions=v.dimensions.slice(0,1);delete (v as Partial<typeof v>).completeness;const report=adaptScoreReport(v);expect(report.completeness).toBe('partial');expect(report.dimensions).toHaveLength(1);expect(report.total_score).toBe(88.4)});
 it('does not infer citation legal categories from untyped citation strings',()=>{const v=copy();delete (v.dimensions[0].items[1] as Partial<typeof v.dimensions[0]['items'][number]>).citation_kind;expect(adaptScoreReport(v).dimensions[0].items[1].citation_kind).toBe('unspecified')});
 it('supports pending scores and unknown server grade labels without client regrading',()=>{const v=copy();v.total_score=null;v.dimensions[0].score=null;v.dimensions[0].items[0].score=null;v.dimensions[0].items[0].status='pending';v.grade='CUSTOM';const report=adaptScoreReport(v);expect(report.total_score).toBeNull();expect(report.grade).toBe('CUSTOM');expect(gradeColor(report.grade)).toBe('#55655c')});
 it.each([NaN,Infinity,-1,101])('rejects invalid total %s without losing physical results',n=>{const v=copy();v.total_score=n;const result=validateSimulation({...mockSimulate(DEFAULTS),score_report:v});expect(result.score_report).toBeUndefined();expect(result.score_report_error).toBeTruthy();expect(result.metrics.winter_penetration_m).toBeGreaterThan(0)});
 it('rejects duplicate ids, inconsistent contributions, and unknown targets',()=>{let v=copy();v.dimensions[1].id=v.dimensions[0].id;expect(()=>adaptScoreReport(v)).toThrow(/重复/);v=copy();v.dimensions[0].items[0].score=1;expect(()=>adaptScoreReport(v)).toThrow(/不一致/);v=copy();(v.dimensions[0].items[0] as unknown as Record<string,unknown>).link_target='https://external';expect(()=>adaptScoreReport(v)).toThrow(/联动/)});
 it('keeps warnings separate and never clears a score for them',()=>{const v=copy();v.warnings=[{id:'low-sun',message:'后端声明日照不足',severity:'warning',item_keys:['winter_sun_hours']}];expect(adaptScoreReport(v).total_score).toBe(88.4)});
});
describe('variable-sized daylight matrix',()=>{
 it.each([[20,20],[24,24],[12,30],[2,256]])('accepts rectangular %i×%i DF grids', (rows,cols)=>{const s=mockSimulate(DEFAULTS);s.heatmap_grid=Array.from({length:rows},()=>Array(cols).fill(2.3));expect(validateSimulation(s).heatmap_grid).toHaveLength(rows)});
 it('rejects empty, ragged, huge or negative grids',()=>{for(const grid of [[],[[]],[[1,2],[3]],Array.from({length:257},()=>[1,2]),[[1,-1],[2,3]]]){const s=mockSimulate(DEFAULTS);s.heatmap_grid=grid;expect(()=>validateSimulation(s)).toThrow(/矩阵/)}});
});
describe('presentation, progressive disclosure and annotation semantics',()=>{
 it('renders an unmistakably independent example in the collapsed capsule',()=>{const out=renderToStaticMarkup(<ScoreCapsule report={fixture} open={false} pending={false} onToggle={noop} buttonRef={createRef()}/>);expect(out).toContain('非当前方案评分');expect(out).toContain('88.4');expect(out).toContain('aria-expanded="false"');expect(out).toContain('width="44"')});
 it('renders old API missing-score state with no invented grade',()=>{const out=renderToStaticMarkup(<ScoreCapsule report={null} open={false} pending={false} onToggle={noop} buttonRef={createRef()}/>);expect(out).toContain('后端尚未提供评分');expect(out).not.toContain('88.4')});
 it('renders ten items, example warning, no S-grade guarantee, and inert closed reports',()=>{const out=renderToStaticMarkup(<ScoreDrawer report={fixture} open={false} pending={false} onClose={noop} onHighlight={noop} onOptimize={noop} onCancel={noop} busy={false} canOptimize>{null}</ScoreDrawer>);expect(out).toContain('inert=""');expect(out).toContain('非当前方案评分');expect(out).toContain('不承诺分数提升或S级');expect(out.match(/class="score-item status-/g)).toHaveLength(10);writeFileSync(new URL('../verification/scoring-r1/drawer-static-markup.html',import.meta.url),out)});
 it('escapes untrusted report text and keeps keyboard-focusable linkage rows',()=>{const d=structuredClone(fixture.dimensions[1]);d.items[0].citation='<script>bad</script>';const out=renderToStaticMarkup(<DimensionAccordion dimension={d} open onToggle={noop} onSpatialAction={noop}/>);expect(out).toContain('&lt;script&gt;');expect(out).not.toContain('<script>');expect(out).toContain('tabindex="0"');expect(out).toContain('仅分析提示')});
 it('highlights only the independent depth annotation, not the true solar ray path',()=>{const result=mockSimulate(DEFAULTS);const a=renderToStaticMarkup(<Section room={EXAMPLE_ROOM} parameters={DEFAULTS} result={result} season="winter"/>),b=renderToStaticMarkup(<Section room={EXAMPLE_ROOM} drawingId="score-linked-section" highlightWinter parameters={DEFAULTS} result={result} season="winter"/>);expect(b).toContain('stroke-width="3.2"');expect(b).toContain('id="score-linked-section"');const solarPaths=(s:string)=>[...s.matchAll(/stroke="#(?:9b5037|80602a)"[^>]*><path d="([^"]+)"/g)].map(m=>m[1]);expect(solarPaths(a)).toEqual(solarPaths(b))});
 it('uses data-only fixture and no thresholds/weights/citations embedded in score components',()=>{for(const filename of ['ScoreRing.tsx','ScoreDrawer.tsx','DimensionAccordion.tsx']){const s=readFileSync(new URL('../src/scoring/'+filename,import.meta.url),'utf8');expect(s).not.toMatch(/GB\s?\d|ISO\s?\d|92[–-]96|SHGC\s*≤/)}const source=readFileSync(new URL('../src/scoring/example.ts',import.meta.url),'utf8');expect(source).not.toContain("from '../model'")});
});
