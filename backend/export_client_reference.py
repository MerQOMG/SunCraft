"""Export the owning score rules and backend oracles for the offline client.

Run from the repository root: .venv/Scripts/python backend/export_client_reference.py
"""
from dataclasses import asdict
import json
from pathlib import Path

from suncraft.demo import StudioParameters, studio_result
from suncraft.optimization import optimize
from suncraft.scene import CITIES
from suncraft.scoring_engine import DIMENSIONS
from suncraft.simulation import simulate

frontend = Path(__file__).resolve().parents[1] / "前端文件"
rules = [{"id": key, "name": name, "rules": [asdict(rule) for rule in entries]}
         for key, name, entries in DIMENSIONS]
(frontend / "src/scoring/rules.json").write_text(
    json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

cases = []
for city, (_, latitude) in CITIES.items():
    settings = [(0.4, 0, 0.45), (0, 0, 0.45), (0.8, 35, 0.5), (0.35, 12, 0.55)]
    settings += [(depth, tilt, ratio) for depth in (0, 1.8) for tilt in (0, 80) for ratio in (0.25, 0.65)]
    for depth, tilt, ratio in settings:
        parameters = StudioParameters(city_id=city, latitude=latitude, overhang_depth_m=depth,
                                      louver_angle_deg=tilt, window_wall_ratio=ratio)
        expected = studio_result(simulate(parameters.design()))
        grid = expected.pop("heatmap_grid")
        expected["heatmap_samples"] = [grid[z][x] for z, x in ((0, 0), (0, 12), (12, 12), (23, 23))]
        cases.append({"parameters": parameters.model_dump(), "expected": expected})

optimization_cases = []
for city, ratio in (("shanghai", 0.45), ("harbin", 0.5), ("beijing", 0.25)):
    parameters = StudioParameters(city_id=city, latitude=CITIES[city][1], overhang_depth_m=0.4,
                                  louver_angle_deg=0, window_wall_ratio=ratio)
    answer = optimize(parameters.design(), studio=True)
    optimization_cases.append({"parameters": parameters.model_dump(), "status": answer.status,
        "best": None if answer.after is None else {
            "overhang_depth_m": answer.after.parameters.overhang_depth_m,
            "louver_angle_deg": answer.after.parameters.louver_tilt_deg,
            "total_score": answer.after.score_report.total_score}})

destination = frontend / "tests/fixtures/backend-scoring-reference.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps({"cases": cases, "optimization_cases": optimization_cases},
                                  ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Exported rules, {len(cases)} simulation cases and {len(optimization_cases)} optimization cases.")
