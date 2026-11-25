from math import cos, radians, sin

import numpy as np
import pytest

from suncraft import scene, scoring_engine, solar
from suncraft.optimization import optimize
from suncraft.schemas import SimulationInput
from suncraft.simulation import simulate


def items(report):
    return {i.key: i for d in report.dimensions for i in d.items}


@pytest.mark.parametrize(("config", "grade", "approx_score"), [
    ({"overhang_depth_m": 0, "louvers_enabled": False}, "C", 55),
    ({"overhang_depth_m": 1.6, "louver_tilt_deg": 75}, "B", 68),
])
def test_extreme_designs(config, grade, approx_score):
    report = simulate(SimulationInput(**config)).score_report
    assert report.grade == grade
    assert report.total_score == pytest.approx(approx_score, abs=4)
    assert [d.weight for d in report.dimensions] == [35, 25, 25, 15]
    assert len(items(report)) == 10
    for d in report.dimensions:
        assert d.weight == sum(i.max_score for i in d.items)
        assert d.score == pytest.approx(sum(i.score for i in d.items), abs=1e-6)
    assert report.total_score == pytest.approx(sum(d.score for d in report.dimensions), abs=1e-6)


def test_shanghai_optimum_and_tie_replay():
    result = optimize(SimulationInput(), include_simulation=True)
    assert result.after.score_report == result.simulation.score_report
    assert result.after.score_report.total_score == pytest.approx(94, abs=3)
    assert result.after.score_report.grade == "S"
    repeated = optimize(result.after.parameters)
    assert repeated.before == repeated.after


@pytest.mark.parametrize(("score", "grade"), [(0,"C"),(64.999,"C"),(65,"B"),(79.999,"B"),
                                               (80,"A"),(89.999,"A"),(90,"S"),(100,"S")])
def test_grade_boundaries(score, grade):
    assert scoring_engine.grade_for(score)[0] == grade


def test_curve_knots_and_both_shgc_limits():
    for _, _, rules in scoring_engine.DIMENSIONS:
        for rule in rules:
            if rule.key == "wwr_shgc":
                for inputs, score in [({"wwr": .45, "shgc": .45}, 15), ({"wwr": .6, "shgc": .4}, 7.5),
                                      ({"wwr": .4, "shgc": .5}, 7.5), ({"wwr": .4, "shgc": .55}, 0)]:
                    assert scoring_engine.contribution(rule, inputs) == pytest.approx(score)
            else:
                measured = scoring_engine.contribution(rule, {rule.key: rule.x})
                np.testing.assert_allclose(measured, np.array(rule.y) * rule.weight)


@pytest.mark.parametrize("config", [{}, {"overhang_depth_m": 1.6, "window_to_wall_ratio": .1},
                                    {"latitude": -33.9, "orientation_deg": 0, "louvers_enabled": False}])
def test_score_uses_the_same_576_samples(config):
    result = simulate(SimulationInput(**config))
    grid = np.array(result.heatmap_grid)
    values = items(result.score_report)
    assert grid.shape == (24, 24)
    assert values["daylight_uniformity"].value == pytest.approx(grid.min() / grid.mean())
    assert values["daylight_compliance_rate"].value == np.mean(grid >= 2)
    assert values["window_floor_ratio"].value == pytest.approx(
        (config.get("window_to_wall_ratio", .5) * scene.HEIGHT) / scene.DEPTH)


def test_unshaded_reference_and_red_lines():
    clear = simulate(SimulationInput(overhang_depth_m=0, louvers_enabled=False, window_to_wall_ratio=.45))
    v = items(clear.score_report)
    assert v["winter_full_window_hours"].value == 8
    assert v["wwr_shgc"].value["shgc"] == .55
    assert v["relative_load_reduction"].value == pytest.approx(0, abs=1e-12)
    assert clear.metrics.summer_shading_rate == 0 and clear.metrics.winter_solar_gain_rate == 1
    assert not clear.score_report.warnings
    shaded = simulate(SimulationInput())
    assert {w.key for w in shaded.score_report.warnings} == {"wwr_shgc", "winter_full_window_hours"}
    assert items(shaded.score_report)["winter_full_window_hours"].value == 0
    assert items(shaded.score_report)["wwr_shgc"].value["shgc"] == pytest.approx(.55 * .25)
    assert items(shaded.score_report)["sofa_summer_hours"].highlight_target == "sofa"
    assert items(shaded.score_report)["winter_penetration_m"].highlight_target == "winter_section"


def independent_sofa_hours(request):
    # For each timestamp, intersect the floor-depth interval with each gap
    # between neighbouring physical slats. The engine instead integrates visible
    # aperture length with a periodic antiderivative, vectorized across time.
    lat, dec, az = map(radians, (request.resolved_latitude, solar.OBLIQUITY, request.orientation_deg))
    window = scene.Window.from_ratio(request.window_to_wall_ratio)
    tilt = radians(request.louver_tilt_deg)
    duration = 0.
    for step in range(97):
        hour = radians((step / 4 - 12) * 15)
        u = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(hour)
        e = -cos(dec) * sin(hour)
        n = cos(lat) * sin(dec) - sin(lat) * cos(dec) * cos(hour)
        normal, side = e * sin(az) + n * cos(az), abs(e * cos(az) - n * sin(az))
        if min(normal, u) <= 1e-12:
            continue
        slope = u / normal
        far = min(3.8, (scene.WINDOW_WIDTH + 2.2) / 2 * normal / max(side, 1e-15))
        lo = max(window.head - slope * far, request.overhang_depth_m * slope, 0)
        hi = min(window.height, window.head - 2 * slope)
        blade = scene.SLAT_CHORD * (sin(tilt) + cos(tilt) * slope) if request.louvers_enabled else 0
        if any(max(lo, z + blade) + 1e-12 < min(hi, z + scene.SLAT_PITCH)
               for z in np.arange(0, window.height, scene.SLAT_PITCH)):
            duration += .125 if step in (0, 96) else .25
    return duration


@pytest.mark.parametrize("orientation", [45, 90, 135, 180, 270])
def test_sofa_footprint_and_daylight_hours(orientation):
    for depth, tilt, enabled in [(0, 0, False), (.32, 25, True), (1.6, 75, True)]:
        q = SimulationInput(orientation_deg=orientation, overhang_depth_m=depth,
                            louver_tilt_deg=tilt, louvers_enabled=enabled)
        v = items(simulate(q).score_report)
        assert v["sofa_summer_hours"].value == independent_sofa_hours(q)
        assert 0 <= v["winter_full_window_hours"].value <= 8
    if orientation in (90, 270):
        assert v["sofa_summer_hours"].value > 0


def test_polar_night_and_unsuitable_orientation_do_not_claim_s_grade():
    q = SimulationInput(latitude=80, orientation_deg=0, louvers_enabled=False)
    result = optimize(q)
    assert result.after.score_report.grade != "S"
    assert items(result.before.score_report)["winter_full_window_hours"].value == 0
