from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import comfort_physics, scene
from .optimization import optimize
from .schemas import (OptimizationResult, OptimizationWithSimulation, SimulationInput,
                      SimulationResult, SimulationSummary)
from .simulation import simulate

app = FastAPI(title="SunCraft 典型客厅光热推演", version="1.1.0")
# Read-only public calculations; supports local Vite and independently hosted frontends.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # An out-of-range JSON exponent can parse as infinity, which cannot be echoed in JSON.
    details = [{key: error[key] for key in ("loc", "msg", "type")} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


@app.get("/api/presets")
def presets():
    return {
        "cities": [{"id": key, "name": name, "latitude": lat}
                   for key, (name, lat) in scene.CITIES.items()],
        "default_inputs": SimulationInput(city=scene.DEFAULT_CITY).model_dump(exclude_none=True),
        "demo_inputs": SimulationInput(city="harbin", louver_tilt_deg=75).model_dump(exclude_none=True),
        "limits": {"overhang_depth_m": [0, scene.MAX_OVERHANG], "louver_tilt_deg": [0, scene.MAX_TILT],
                   "window_to_wall_ratio": [scene.WWR_MIN, scene.WWR_MAX], "orientation_deg": [0, 360]},
        "room": {"width_m": scene.WIDTH, "depth_m": scene.DEPTH, "height_m": scene.HEIGHT,
                 "window_width_m": scene.WINDOW_WIDTH, "sill_m": scene.SILL,
                 "slat_chord_m": scene.SLAT_CHORD, "slat_pitch_m": scene.SLAT_PITCH,
                 "sofa_depth_range_m": [comfort_physics.SOFA_NEAR, comfort_physics.SOFA_FAR],
                 "sofa_width_m": comfort_physics.SOFA_WIDTH,
                 "grid_shape": [scene.GRID_SIZE, scene.GRID_SIZE]},
        "daylight_standard": {"reference": "GB 50033（方案演示阈值）",
                              "min_df_percent": scene.DF_THRESHOLD,
                              "min_compliant_area_rate": scene.AREA_TARGET},
    }


@app.post("/api/simulate")
def simulate_route(
    request: SimulationInput, include_heatmap: bool = True,
) -> SimulationResult | SimulationSummary:
    """普通拖动可设置 include_heatmap=false，只返回太阳角度、指标与剖面光线。"""
    return simulate(request, include_heatmap=include_heatmap)


@app.post("/api/optimize")
def optimize_route(
    request: SimulationInput, include_simulation: bool = False,
) -> OptimizationWithSimulation | OptimizationResult:
    """设置 include_simulation=true 可取得推荐设计的完整模拟；无可行解时 simulation 为 null。"""
    return optimize(request, include_simulation=include_simulation)
