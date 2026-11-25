from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import scene
from .schemas import SimulationInput, SimulationResult
from .simulation import simulate

app = FastAPI(title="SunCraft 典型客厅光热推演", version="1.0.0")
# Read-only public calculations; supports local Vite and independently hosted frontends.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"])


@app.get("/api/presets")
def presets():
    return {
        "cities": [{"id": key, "name": name, "latitude": lat}
                   for key, (name, lat) in scene.CITIES.items()],
        "default_inputs": SimulationInput(city=scene.DEFAULT_CITY).model_dump(exclude_none=True),
        "limits": {"overhang_depth_m": [0, scene.MAX_OVERHANG], "louver_tilt_deg": [0, scene.MAX_TILT],
                   "window_to_wall_ratio": [scene.WWR_MIN, scene.WWR_MAX], "orientation_deg": [0, 360]},
        "room": {"width_m": scene.WIDTH, "depth_m": scene.DEPTH, "height_m": scene.HEIGHT,
                 "window_width_m": scene.WINDOW_WIDTH, "sill_m": scene.SILL,
                 "slat_chord_m": scene.SLAT_CHORD, "slat_pitch_m": scene.SLAT_PITCH,
                 "grid_shape": [scene.GRID_SIZE, scene.GRID_SIZE]},
        "daylight_standard": {"reference": "GB 50033（方案演示阈值）",
                              "min_df_percent": scene.DF_THRESHOLD,
                              "min_compliant_area_rate": scene.AREA_TARGET},
    }


@app.post("/api/simulate")
def simulate_route(request: SimulationInput) -> SimulationResult:
    return simulate(request)
