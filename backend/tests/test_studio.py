import pytest
from fastapi.testclient import TestClient

from suncraft.demo import FRONTEND, app

DEFAULTS = dict(city_id="shanghai", latitude=31.2, overhang_depth_m=.4,
                louver_angle_deg=0, window_wall_ratio=.45)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as session:
        yield session


def test_page_and_engine(client):
    page = client.get("/")
    assert page.headers["content-type"].startswith("text/html")
    assert page.content == FRONTEND.read_bytes()
    assert client.post("/engine/api/simulate", json={}).status_code == 200


def test_all_presets_and_slider_limits(client):
    presets = client.get("/api/presets").json()
    assert presets["daylight_threshold_pct"] == 2
    assert len(presets["cities"]) == 4
    for city in presets["cities"]:
        for ratio, depth, angle in [(.25, 0, 0), (.65, 1.8, 80)]:
            response = client.post("/api/simulate", json=dict(
                city_id=city["id"], latitude=city["latitude"], window_wall_ratio=ratio,
                overhang_depth_m=depth, louver_angle_deg=angle))
            assert response.status_code == 200
            data = response.json()
            assert len(data["heatmap_grid"]) == 24
            assert all(len(row) == 24 for row in data["heatmap_grid"])
            report = data["score_report"]
            assert (report["provenance"], report["completeness"]) == ("backend", "complete")
            assert len(report["dimensions"]) == 4
            items = [i for d in report["dimensions"] for i in d["items"]]
            assert len(items) == 10
            assert {i["citation_kind"] for i in items} == {"project", "reference", "mandatory"}
            assert {i["link_target"] for i in items if "link_target" in i} == {"winter-depth", "sofa"}
            assert all(w["item_keys"] == [w["key"]] for w in report["warnings"])


def test_optimization_is_replayable(client):
    payload = {**DEFAULTS, "city_id": "harbin", "latitude": 45.8,
               "overhang_depth_m": 1.8, "louver_angle_deg": 80}
    response = client.post("/api/optimize", json=payload)
    assert response.status_code == 200
    result = response.json()
    best = result["parameters"]
    for k in ("city_id", "latitude", "window_wall_ratio"):
        assert best[k] == payload[k]
    assert round(best["overhang_depth_m"] * 20) == pytest.approx(best["overhang_depth_m"] * 20)
    assert best["louver_angle_deg"].is_integer()
    assert result["before"] == client.post("/api/simulate", json=payload).json()
    assert result["after"] == client.post("/api/simulate", json=best).json()
    assert result["after"]["metrics"]["is_gb_compliant"]


def test_infeasible_and_invalid_requests(client):
    response = client.post("/api/optimize", json={**DEFAULTS, "window_wall_ratio": .25})
    assert response.status_code == 409
    assert response.json()["detail"]["max_daylight_compliance_rate"] < .8
    for update in ({"latitude": 39.9}, {"louver_angle_deg": 81}, {"overhang_depth_m": 1.81}):
        assert client.post("/api/simulate", json={**DEFAULTS, **update}).status_code == 422
