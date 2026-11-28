import definitions from './rules.json' with { type: 'json' };
import type { ScoreReport, ScoreItem } from './report';

// Generated from backend/suncraft/scoring_engine.py by export_client_reference.py.
// Report formatting and grid search both use these same rules and contributions.
export type PerformanceValues = Record<string, number>;
type Rule = (typeof definitions)[number]['rules'][number];
const round = (value: number) => Math.round(value * 1e6) / 1e6;
function interpolate(value: number, xs: number[], ys: number[]) {
  if (value <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (value <= xs[i])
      return ys[i - 1] + ((ys[i] - ys[i - 1]) * (value - xs[i - 1])) / (xs[i] - xs[i - 1]);
  }
  return ys[ys.length - 1];
}
function contribution(rule: Rule, values: PerformanceValues) {
  const incident = values.summer_incident !== 0;
  const fraction =
    rule.key === 'wwr_shgc'
      ? Math.min(
          interpolate(values.wwr, rule.x, rule.y),
          incident ? interpolate(values.shgc, [0.45, 0.55], [1, 0]) : 1,
        )
      : rule.key === 'summer_shading_rate' && !incident
        ? 1
        : interpolate(values[rule.key], rule.x, rule.y);
  return round(fraction * rule.weight);
}
export function localTotal(values: PerformanceValues) {
  return round(
    definitions.reduce(
      (total, dimension) =>
        total + dimension.rules.reduce((sum, rule) => sum + contribution(rule, values), 0),
      0,
    ),
  );
}
export function localScoreReport(values: PerformanceValues): ScoreReport {
  const dimensions = definitions.map((dimension) => {
    const items: ScoreItem[] = dimension.rules.map((rule) => {
      const paired = rule.key === 'wwr_shgc',
        value = values[rule.key],
        noSummerBeam = values.summer_incident === 0;
      const passed = paired
        ? (noSummerBeam ? values.wwr : Math.max(values.wwr, values.shgc)) <= rule.target
        : rule.key === 'summer_shading_rate' && noSummerBeam
          ? true
          : rule.y[0] > rule.y[rule.y.length - 1]
            ? value <= rule.target
            : value >= rule.target;
      return {
        key: rule.key,
        name: rule.name,
        value_display: paired
          ? `WWR ${values.wwr.toFixed(3)} / SHGC ${values.shgc.toFixed(3)}${noSummerBeam ? '（该工况无正面直射）' : ''}`
          : rule.key === 'summer_shading_rate' && noSummerBeam
            ? '无正面直射 · 无需直射遮挡'
            : rule.unit === '%'
              ? `${(value * 100).toFixed(1)}%`
              : `${value.toFixed(3)} ${rule.unit}`.trim(),
        threshold_display:
          noSummerBeam && paired
            ? '无正面直射：本项目仅按 WWR ≤ 0.45 筛查，SHGC 仍需专业核查'
            : noSummerBeam && rule.key === 'summer_shading_rate'
              ? '当前工况无直射风险，按目标已满足计分；非全年结论'
              : rule.threshold,
        score: contribution(rule, values),
        max_score: rule.weight,
        status: passed ? 'pass' : 'warn',
        citation: rule.citation,
        citation_kind:
          rule.kind === 'mandatory_reference'
            ? 'mandatory'
            : rule.kind === 'project'
              ? 'project'
              : 'reference',
        ...(rule.highlight === 'winter_section'
          ? { link_target: 'winter-depth' as const }
          : rule.highlight === 'sofa'
            ? { link_target: 'sofa' as const }
            : {}),
      };
    });
    return {
      id: dimension.id,
      name: dimension.name,
      weight: items.reduce((sum, item) => sum + item.max_score, 0),
      score: round(items.reduce((sum, item) => sum + (item.score ?? 0), 0)),
      items,
    };
  });
  const total = localTotal(values),
    grade = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 65 ? 'B' : 'C';
  const warnings: ScoreReport['warnings'] = [];
  if (values.summer_incident === 0)
    warnings.push({
      id: 'summer_shading_rate',
      message:
        '夏至正午南窗无正面直射：遮阳按无直射风险计分，SHGC 项仅按窗墙比筛查；不代表全年无需遮阳或热工规范豁免。',
      severity: 'warning',
      item_keys: ['summer_shading_rate'],
    });
  if (values.wwr > 0.45)
    warnings.push({
      id: 'wwr_shgc',
      message: '窗墙比超过方案筛查线 0.45，需按地区与构造核查适用条文。',
      severity: 'warning',
      item_keys: ['wwr_shgc'],
    });
  if (values.winter_full_window_hours < 1)
    warnings.push({
      id: 'winter_full_window_hours',
      message: '冬至 08–16 时整窗同时直射不足 1 小时。',
      severity: 'warning',
      item_keys: ['winter_full_window_hours'],
    });
  return {
    total_score: total,
    max_score: 100,
    grade,
    grade_label: { S: '卓越', A: '优良 · 推荐方案', B: '合格', C: '待优化' }[grade],
    warnings,
    dimensions,
    provenance: 'local',
    completeness: 'complete',
    version: 'local-engine-v1',
    methodology_note:
      '根据当前方案在本机实时计算，采用与后端相同的解析遮阳、均匀漫射天空 DF、季节时段取样及四维十项评分规则。相对负荷用于方案比较；模型精度与规范适用性仍需专业校核。',
  };
}
