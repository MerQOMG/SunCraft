import numpy as np

from . import daylight, scene, solar
from .schemas import Angles, Metrics, Section, SimulationInput, SimulationResult


def simulate(request: SimulationInput) -> SimulationResult:
    window = scene.Window.from_ratio(request.window_to_wall_ratio)
    suns = solar.solstices(request.resolved_latitude, request.orientation_deg)
    depth, tilt = request.overhang_depth_m, request.louver_tilt_deg
    shading, gain = solar.direct_rates(window, suns, depth, tilt)
    base = daylight.unshaded_grid(window)
    grid = base * daylight.diffuse_transmission(window, depth, tilt)
    passing = float(np.mean(grid >= scene.DF_THRESHOLD))
    summer, winter = suns
    summer_rays, winter_rays = [solar.section_rays(window, sun, depth, tilt) for sun in suns]
    penetration = next((ray.end[0] for ray in winter_rays if ray.kind == "transmitted"), 0.0)
    return SimulationResult(
        solar_angles=Angles(summer_noon_alt=summer.altitude, summer_noon_az=summer.azimuth,
                            winter_noon_alt=winter.altitude, winter_noon_az=winter.azimuth),
        metrics=Metrics(summer_shading_rate=shading, winter_solar_gain_rate=gain,
                        daylight_compliance_rate=passing, is_gb_compliant=passing >= scene.AREA_TARGET,
                        winter_penetration_m=penetration),
        heatmap_grid=grid.tolist(),
        svg_rays=Section(summer_incident=summer.slope is not None, winter_incident=winter.slope is not None,
                         summer_blocked=summer.slope is not None and shading == 1,
                         winter_hit_depth=penetration, summer=summer_rays, winter=winter_rays),
    )
