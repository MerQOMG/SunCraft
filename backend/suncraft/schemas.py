from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from . import scene


class SimulationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)

    city: str | None = Field(None, description="Preset ID from /api/presets")
    latitude: float | None = Field(None, gt=-90, lt=90, description="Degrees north")
    orientation_deg: float = Field(scene.DEFAULT_ORIENTATION, ge=0, le=360,
                                   description="Outward facade normal, clockwise from north")
    window_to_wall_ratio: float = Field(scene.DEFAULT_WWR, ge=scene.WWR_MIN, le=scene.WWR_MAX)
    overhang_depth_m: float = Field(scene.DEFAULT_OVERHANG, ge=0, le=scene.MAX_OVERHANG)
    louver_tilt_deg: float = Field(scene.DEFAULT_TILT, ge=0, le=scene.MAX_TILT,
                                   description="Outer edge tilts downward from horizontal")

    @model_validator(mode="after")
    def check_location(self):
        if self.city is not None and self.latitude is not None:
            raise ValueError("Supply either city or latitude")
        if self.city is not None and self.city not in scene.CITIES:
            raise ValueError(f"Unknown city. Choose from {', '.join(scene.CITIES)}")
        return self

    @property
    def resolved_latitude(self) -> float:
        if self.latitude is not None:
            return self.latitude
        return scene.CITIES[self.city or scene.DEFAULT_CITY][1]


class Angles(BaseModel):
    summer_noon_alt: float
    summer_noon_az: float | None
    winter_noon_alt: float
    winter_noon_az: float | None


class Metrics(BaseModel):
    summer_shading_rate: float
    winter_solar_gain_rate: float
    daylight_compliance_rate: float
    is_gb_compliant: bool
    winter_penetration_m: float


class Ray(BaseModel):
    kind: Literal["blocked", "transmitted"]
    start: tuple[float, float]
    end: tuple[float, float]
    window_entry: tuple[float, float] | None = None


class Section(BaseModel):
    summer_incident: bool
    winter_incident: bool
    summer_blocked: bool
    winter_hit_depth: float
    summer: list[Ray]
    winter: list[Ray]


class SimulationResult(BaseModel):
    solar_angles: Angles
    metrics: Metrics
    heatmap_grid: list[list[float]]
    svg_rays: Section


class EvaluatedDesign(BaseModel):
    parameters: SimulationInput
    metrics: Metrics


class SearchStats(BaseModel):
    candidate_count: int
    feasible_count: int
    pareto_objective_count: int
    max_daylight_compliance_rate: float


class OptimizationResult(BaseModel):
    status: Literal["optimal", "infeasible"]
    reason: str | None = None
    before: EvaluatedDesign
    after: EvaluatedDesign | None
    search: SearchStats
