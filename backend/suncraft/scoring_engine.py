"""One set of piecewise-linear project rules for both reports and grid search."""

from dataclasses import dataclass

import numpy as np

from .schemas import ScoreDimension, ScoreItem, ScoreReport, ScoreWarning


@dataclass(frozen=True)
class Rule:
    key: str
    name: str
    weight: int
    # Ordered x coordinates; y is fraction of available points.
    x: tuple
    y: tuple
    target: float
    threshold: str
    unit: str
    citation: str
    kind: str = "reference"
    highlight: str | None = None


DIMENSIONS = (
    ("summer_shading", "夏季遮阳与防过热", (
        Rule("summer_shading_rate", "夏季遮挡率", 20, (.4, .9), (0, 1), .85,
             "目标 ≥ 85%，满分 ≥ 90%", "%", "项目目标（解析几何）", "project"),
        Rule("wwr_shgc", "窗墙比与等效 SHGC", 15, (.45, .75), (1, 0), .45,
             "WWR 与 SHGC 均 ≤ 0.45", "", "强制规范参考 GB 55015—2021，参照 GB 50176—2016；数值为项目筛查线",
             "mandatory_reference"),
    )),
    ("winter_gain", "冬季得热与日照", (
        Rule("winter_solar_gain_rate", "冬季得热率", 12, (.4, .8), (0, 1), .75,
             "目标 ≥ 75%，满分 ≥ 80%", "%", "项目目标（冬至真太阳正午）", "project"),
        Rule("winter_penetration_m", "冬季阳光进深", 8, (0, 2.8), (0, 1), 2.5,
             "目标 ≥ 2.5 m，满分 ≥ 2.8 m", "m", "项目目标（沙发区）", "project", "winter_section"),
        Rule("winter_full_window_hours", "冬至日满窗日照时数", 5, (0, 1, 2), (0, .6, 1), 1,
             "及格 ≥ 1 h，满分 ≥ 2 h", "h", "参照 GB 50180—2018，按项目满窗几何口径"),
    )),
    ("daylight", "室内自然采光", (
        Rule("daylight_compliance_rate", "采光达标面积比", 15, (0, .8, .85), (0, .8, 1), .8,
             "DF ≥ 2% 的面积占比 ≥ 80%，满分 ≥ 85%", "%", "参照 GB 50033—2013（DF）"),
        Rule("daylight_uniformity", "采光均匀度", 5, (0, .4), (0, 1), .4,
             "Emin / Eavg ≥ 0.40", "", "参照 GB 50033—2013，采用地板网格"),
        Rule("window_floor_ratio", "窗地面积比", 5, (0, 1/7, 1/6), (0, .6, 1), 1/7,
             "及格 ≥ 1/7，满分 ≥ 1/6", "", "参照 GB 50096—2011（方案列示）"),
    )),
    ("health_carbon", "居住健康与低碳", (
        Rule("sofa_summer_hours", "沙发区夏季直射暴露时长", 8, (.5, 2, 4), (1, .6, 0), 2,
             "及格 ≤ 2 h/d，满分 ≤ 0.5 h/d", "h/d", "参照 ISO 105-B02，时长为项目代理指标",
             "reference", "sofa"),
        Rule("relative_load_reduction", "相对节能降碳潜力", 7, (0, .25), (0, 1), .25,
             "较同窗无遮阳基准降负荷 ≥ 25%", "%", "参照 GB/T 51366—2019，采用相对负荷代理"),
    )),
)


def contribution(rule, values):
    if rule.key == "wwr_shgc":
        wwr = np.interp(values["wwr"], rule.x, rule.y)
        shgc = np.interp(values["shgc"], (.45, .55), (1, 0))
        fraction = np.minimum(wwr, shgc)
    else:
        fraction = np.interp(values[rule.key], rule.x, rule.y)
    return np.round(fraction * rule.weight, 6)


def evaluate(values, *, report=False):
    """With scalar inputs build a UI report; with vectors evaluate all candidate totals."""
    dimensions = []
    total = 0.0
    for key, name, rules in DIMENSIONS:
        subtotal = 0.0
        items = []
        for rule in rules:
            score = contribution(rule, values)
            subtotal = subtotal + score
            if report:
                items.append(describe_item(rule, values, float(score)))
        total = total + subtotal
        if report:
            dimensions.append(ScoreDimension(id=key, name=name, weight=sum(r.weight for r in rules),
                                             score=round(float(subtotal), 6), items=items))
    total = np.round(total, 6)
    if not report:
        return total
    return make_report(float(total), dimensions, values)


def describe_item(rule, values, score):
    if rule.key == "wwr_shgc":
        value = {"wwr": float(values["wwr"]), "shgc": float(values["shgc"])}
        display = f"WWR {value['wwr']:.3f} / SHGC {value['shgc']:.3f}"
        passed = max(value.values()) <= rule.target
    else:
        value = float(values[rule.key])
        display = f"{value:.1%}" if rule.unit == "%" else f"{value:.3f} {rule.unit}".strip()
        passed = value <= rule.target if rule.y[0] > rule.y[-1] else value >= rule.target
    return ScoreItem(key=rule.key, name=rule.name, value=value, value_display=display,
                     threshold_display=rule.threshold, score=score, max_score=rule.weight,
                     status="pass" if passed else "warn", citation=rule.citation,
                     citation_type=rule.kind, highlight_target=rule.highlight)


def grade_for(total):
    for minimum, grade, label in ((90, "S", "卓越"), (80, "A", "优良 · 推荐方案"),
                                  (65, "B", "合格"), (0, "C", "待优化")):
        if total >= minimum:
            return grade, label
    raise ValueError("negative score")


def make_report(total, dimensions, values):
    grade, label = grade_for(total)
    warnings = []
    if values["wwr"] > .45:
        warnings.append(ScoreWarning(key="wwr_shgc", message="窗墙比超过方案筛查线 0.45，需按地区与构造核查适用条文。"))
    if values["winter_full_window_hours"] < 1:
        warnings.append(ScoreWarning(key="winter_full_window_hours", message="冬至 08–16 时整窗同时直射不足 1 小时。"))
    return ScoreReport(total_score=total, grade=grade, grade_label=label, warnings=warnings,
                       methodology_note="全阴天 DF 的均匀漫射天空近似与解析几何。相对负荷仅作方案比较；±10% 精度目标尚未标定。",
                       suggest_optimization=total < 85, dimensions=dimensions)
