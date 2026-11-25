from math import cos, radians, sin

import numpy as np
import pytest
from fastapi.testclient import TestClient

from suncraft import scene, solar
from suncraft.api import app
from suncraft.optimization import pareto_indices


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as session:
        yield session


def post(client, endpoint, payload):
    response = client.post("/api/" + endpoint, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_presets_and_defaults(client):
    presets = client.get("/api/presets").json()
    assert {city["id"] for city in presets["cities"]} == {"shanghai", "beijing", "guangzhou", "harbin"}
    assert presets["daylight_standard"]["min_df_percent"] == 2
    assert presets["daylight_standard"]["min_compliant_area_rate"] == 0.8
    assert post(client, "simulate", presets["default_inputs"]) == post(client, "simulate", {})
    assert post(client, "simulate", {"latitude": 31.2}) == post(client, "simulate", {})
    assert post(client, "simulate", {"orientation_deg": 0}) == post(client, "simulate", {"orientation_deg": 360})


@pytest.mark.parametrize("payload", [
    {}, {"city": "harbin", "overhang_depth_m": 0.23, "louver_tilt_deg": 32},
    {"latitude": -33.9, "orientation_deg": 0, "window_to_wall_ratio": 0.75},
    {"latitude": 70, "overhang_depth_m": 1.6, "louver_tilt_deg": 75, "window_to_wall_ratio": 0.1},
])
def test_grid_and_section_agree_with_metrics(client, payload):
    result = post(client, "simulate", payload)
    grid = np.array(result["heatmap_grid"])
    metrics, rays = result["metrics"], result["svg_rays"]
    assert grid.shape == (24, 24)
    assert np.isfinite(grid).all() and np.min(grid) >= 0
    np.testing.assert_allclose(grid, grid[:, ::-1])
    assert np.mean(grid[:6]) > np.mean(grid[-6:])
    assert np.mean(grid >= 2) == metrics["daylight_compliance_rate"]
    assert metrics["is_gb_compliant"] == (metrics["daylight_compliance_rate"] >= 0.8)
    reaches = [ray["end"][0] for ray in rays["winter"] if ray["kind"] == "transmitted"]
    assert metrics["winter_penetration_m"] == rays["winter_hit_depth"] == max(reaches, default=0)
    for season in ("summer", "winter"):
        for ray in rays[season]:
            assert ray["start"][0] < ray["end"][0]
            if ray["kind"] == "transmitted":
                assert ray["window_entry"][0] == 0
                assert (ray["end"][0] == scene.DEPTH or ray["end"][1] == pytest.approx(0))
            else:
                assert ray["window_entry"] is None and ray["end"][0] <= 0


def test_solstice_geometry_and_missing_sun(client):
    shanghai = post(client, "simulate", {})
    angles = shanghai["solar_angles"]
    assert angles["summer_noon_alt"] == pytest.approx(82.24)
    assert angles["winter_noon_alt"] == pytest.approx(35.36)
    assert angles["summer_noon_az"] == angles["winter_noon_az"] == 180
    assert shanghai["svg_rays"]["summer_blocked"] and shanghai["metrics"]["summer_shading_rate"] == 1
    rear = post(client, "simulate", {"city": "guangzhou"})
    assert rear["solar_angles"]["summer_noon_az"] == 0
    assert rear["svg_rays"]["summer"] == [] and not rear["svg_rays"]["summer_incident"]
    assert not rear["svg_rays"]["summer_blocked"] and rear["metrics"]["summer_shading_rate"] == 0
    polar = post(client, "simulate", {"latitude": 80})
    assert polar["solar_angles"]["winter_noon_alt"] < 0
    assert polar["svg_rays"]["winter"] == [] and polar["metrics"]["winter_solar_gain_rate"] == 0
    zenith = post(client, "simulate", {"latitude": 23.44})
    assert zenith["solar_angles"]["summer_noon_az"] is None and not zenith["svg_rays"]["summer_incident"]


def test_periodic_shadow_against_explicit_interval_union():
    # Clip and merge every physical shadow independently of the periodic formula.
    for height in (0.34, 0.9, 1.35, 2.25):
        for slope in (0.1, 1, 2, 8):
            for depth in (0, 0.45, 1.35):
                for tilt in (0, 35, 75):
                    blade = scene.SLAT_CHORD * (sin(radians(tilt)) + slope * cos(radians(tilt)))
                    intervals = [(0, depth * slope)]
                    intervals.extend((d, d + blade) for d in np.arange(0, height, scene.SLAT_PITCH))
                    covered = right = 0.0
                    for start, end in sorted(intervals):
                        end = min(height, end)
                        covered += max(0, end - max(start, right))
                        right = max(end, right)
                    actual = solar.opening_fraction(scene.Window(height), depth, tilt, slope)
                    assert actual == pytest.approx(1 - covered / height, abs=1e-12)


@pytest.mark.parametrize("payload", [
    {"city": "unknown"}, {"city": "beijing", "latitude": 31.2}, {"latitude": 91},
    {"window_to_wall_ratio": 0.9}, {"overhang_depth_m": -0.01}, {"louver_tilt_deg": 76},
    {"orientation_deg": 361}, {"window_to_wall_ratio": True}, {"typo": 1},
])
def test_validation(client, payload):
    for path in ("simulate", "optimize"):
        assert client.post("/api/" + path, json=payload).status_code == 422


def test_nonfinite_json_number(client):
    r = client.post("/api/simulate", content='{"latitude":1e999}', headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["detail"][0]["loc"][-1] == "latitude"


def test_optimizer_matches_independent_route_enumeration(client):
    current = {"city": "harbin", "window_to_wall_ratio": 0.49, "orientation_deg": 90,
               "overhang_depth_m": 0.233, "louver_tilt_deg": 21.3}
    result = post(client, "optimize", current)
    assert result["status"] == "optimal"
    assert result["before"]["metrics"] == post(client, "simulate", current)["metrics"]
    chosen = result["after"]["parameters"]
    for key in ("city", "orientation_deg", "window_to_wall_ratio"):
        assert chosen[key] == current[key]
    metrics = post(client, "simulate", chosen)["metrics"]
    assert metrics == result["after"]["metrics"] and metrics["is_gb_compliant"]
    # Exhaust the public 41 x 25 grid plus the off-grid baseline. Use the scalar
    # simulation independently of the vectorized optimizer and its frontier sweep.
    from suncraft.schemas import SimulationInput
    from suncraft.simulation import simulate

    pairs = [(d / 25, t * 75 / 24) for d in range(41) for t in range(25)]
    pairs.append((current["overhang_depth_m"], current["louver_tilt_deg"]))
    scores = []
    for depth, tilt in pairs:
        design = dict(current, overhang_depth_m=depth, louver_tilt_deg=tilt)
        simulated = simulate(SimulationInput(**design), include_heatmap=False)
        if simulated.metrics.is_gb_compliant:
            scores.append(simulated.score_report.total_score)
    assert result["search"]["candidate_count"] == len(pairs)
    assert result["search"]["feasible_count"] == len(scores)
    assert result["search"]["objective"] == "total_score"
    assert result["after"]["score_report"]["total_score"] == max(scores)
    assert result["after"]["score_report"] == post(client, "simulate", chosen)["score_report"]
    assert result == post(client, "optimize", current)


def test_pareto_filter_removes_dominated_ties_and_infeasible_points():
    shading = np.array([1, 1, 1, 0.8, 0.7, 0.6, 1])
    gain = np.array([0.5, 0.4, 0.5, 0.7, 0.7, 1, 1])
    area = np.array([0.8, 1, 0.9, 0.85, 1, 1, 0.79])
    assert pareto_indices(shading, gain, area, np.zeros(7), np.zeros(7)).tolist() == [2, 3, 5]


def test_infeasible_and_cors(client):
    r = post(client, "optimize", {"window_to_wall_ratio": 0.1, "overhang_depth_m": 0.12})
    assert r["status"] == "infeasible" and r["after"] is None
    assert r["reason"] == "daylight_target_unreachable"
    assert r["search"]["candidate_count"] == 1025 and r["search"]["feasible_count"] == 0
    assert r["search"]["max_daylight_compliance_rate"] < 0.8
    preflight = client.options("/api/simulate", headers={"Origin": "http://localhost:5173",
                               "Access-Control-Request-Method": "POST",
                               "Access-Control-Request-Headers": "content-type"})
    assert preflight.status_code == 200 and "access-control-allow-origin" in preflight.headers


def test_demo_start_and_single_request_replay(client):
    presets = client.get("/api/presets").json()
    assert presets["default_inputs"]["city"] == "shanghai"
    start = presets["demo_inputs"]
    original = post(client, "optimize", start)
    result = post(client, "optimize?include_simulation=true", start)
    simulation = result.pop("simulation")
    assert result == original and result["status"] == "optimal"
    assert simulation == post(client, "simulate", result["after"]["parameters"])
    assert simulation["metrics"] == result["after"]["metrics"]
    assert simulation["score_report"] == result["after"]["score_report"]
    assert simulation["score_report"]["total_score"] > result["before"]["score_report"]["total_score"]
    assert simulation["score_report"]["grade"] == "S"
    assert simulation["metrics"]["summer_shading_rate"] >= 0.90
    assert simulation["metrics"]["winter_solar_gain_rate"] >= result["before"]["metrics"]["winter_solar_gain_rate"]


@pytest.mark.parametrize("design", [{}, {"window_to_wall_ratio": 0.1}, {"latitude": 80},
                                    {"city": "guangzhou", "overhang_depth_m": 0.137}])
def test_drag_summary_matches_heatmap_view(client, design):
    full = post(client, "simulate", design)
    assert post(client, "simulate?include_heatmap=true", design) == full
    assert len(full.pop("heatmap_grid")) == scene.GRID_SIZE
    assert post(client, "simulate?include_heatmap=false", design) == full


def test_combined_infeasible_response(client):
    design = {"window_to_wall_ratio": 0.1}
    combined = post(client, "optimize?include_simulation=true", design)
    assert combined.pop("simulation") is None
    assert combined == post(client, "optimize", design)


def test_bulk_compliance_matches_products_at_threshold():
    from suncraft.daylight import compliance_rates

    base = np.array([[1.0, 2.0, 2.0], [3.1, 4.9, 8.0]])
    edges = scene.DF_THRESHOLD / base.ravel()
    values = np.r_[0, 1, np.nextafter(edges, 0), edges, np.nextafter(edges, np.inf)]
    expected = np.mean(base.ravel() * values[:, None] >= scene.DF_THRESHOLD, axis=1)
    np.testing.assert_array_equal(compliance_rates(base, values), expected)


def test_off_grid_request_does_not_change_fixed_candidates(client):
    design = {"city": "beijing", "window_to_wall_ratio": 0.52, "overhang_depth_m": 0.12}
    fixed = post(client, "optimize", design)
    extra = post(client, "optimize", dict(design, overhang_depth_m=0.137, louver_tilt_deg=35.2))
    assert fixed["search"]["candidate_count"] + 1 == extra["search"]["candidate_count"]
    assert fixed == post(client, "optimize", design)
