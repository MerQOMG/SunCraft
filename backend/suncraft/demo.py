"""Same-origin entry point for the checked-in SunCraft Studio."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from . import scene
from .api import app as engine_app, validation_error
from .optimization import optimize
from .schemas import SimulationInput, SimulationResult
from .simulation import simulate

FRONTEND = Path(__file__).resolve().parents[2] / "前端文件" / "SunCraft-离线演示.html"
app = FastAPI(title="SunCraft Studio", version="1.0")
app.add_exception_handler(RequestValidationError, validation_error)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])
app.mount("/engine", engine_app)


class StudioDesign(SimulationInput):
    overhang_depth_m: float = Field(ge=0, le=1.8)
    louver_tilt_deg: float = Field(ge=0, le=80)


class StudioParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)

    city_id: str
    latitude: float
    overhang_depth_m: float = Field(ge=0, le=1.8)
    louver_angle_deg: float = Field(ge=0, le=80)
    window_wall_ratio: float = Field(ge=.25, le=.65)

    @model_validator(mode="after")
    def match_city(self):
        city = scene.CITIES.get(self.city_id)
        if city is None or city[1] != self.latitude:
            raise ValueError("City and latitude must match a published preset")
        return self

    def design(self):
        return StudioDesign(city=self.city_id, overhang_depth_m=self.overhang_depth_m,
                            louver_tilt_deg=self.louver_angle_deg,
                            window_to_wall_ratio=self.window_wall_ratio)


def studio_result(result: SimulationResult):
    data = result.model_dump(mode="json")
    report = data["score_report"]
    report.update(max_score=100, provenance="backend", completeness="complete")
    for dimension in report["dimensions"]:
        for item in dimension["items"]:
            kind = item["citation_type"]
            item["citation_kind"] = "mandatory" if kind == "mandatory_reference" else kind
            target = item["highlight_target"]
            if target:
                item["link_target"] = {"winter_section": "winter-depth", "sofa": "sofa"}[target]
    for warning in report["warnings"]:
        warning.update(id=warning["key"], severity="warning", item_keys=[warning["key"]])
    return data


@app.get("/", response_class=FileResponse, include_in_schema=False)
def studio_page():
    return FileResponse(FRONTEND, media_type="text/html")


@app.get("/api/presets")
def studio_presets():
    return {"cities": [{"id": key, "name": name, "latitude": lat}
                       for key, (name, lat) in scene.CITIES.items()],
            "daylight_threshold_pct": scene.DF_THRESHOLD}


@app.post("/api/simulate")
def studio_simulate(parameters: StudioParameters):
    return studio_result(simulate(parameters.design()))


@app.post("/api/optimize")
def studio_optimize(parameters: StudioParameters):
    design = parameters.design()
    result = optimize(design, studio=True, include_simulation=True)
    if result.after is None:
        raise HTTPException(status_code=409, detail={
            "reason": result.reason, "max_daylight_compliance_rate": result.search.max_daylight_compliance_rate,
            "required_daylight_compliance_rate": scene.AREA_TARGET,
        })
    best = result.after.parameters
    return {
        "parameters": {**parameters.model_dump(), "overhang_depth_m": best.overhang_depth_m,
                       "louver_angle_deg": best.louver_tilt_deg},
        "before": studio_result(simulate(design)),
        "after": studio_result(result.simulation),
    }
