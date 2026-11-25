import numpy as np

from . import comfort_physics, daylight, scene, scoring_engine, solar
from .schemas import Angles, Metrics, Section, SimulationInput, SimulationResult, SimulationSummary


def simulate(request: SimulationInput, *, include_heatmap: bool = True) -> SimulationResult | SimulationSummary:
    window = scene.Window.from_ratio(request.window_to_wall_ratio)
    suns = solar.solstices(request.resolved_latitude, request.orientation_deg)
    depth, tilt = request.overhang_depth_m, request.louver_tilt_deg
    enabled = request.louvers_enabled
    shading, gain = solar.direct_rates(window, suns, depth, tilt, enabled)
    base = daylight.unshaded_grid(window)
    grid = base * daylight.diffuse_transmission(window, depth, tilt, enabled)
    passing = float(np.mean(grid >= scene.DF_THRESHOLD))
    summer, winter = suns
    summer_rays, winter_rays = [solar.section_rays(window, sun, depth, tilt, enabled) for sun in suns]
    penetration = next((ray.end[0] for ray in winter_rays if ray.kind == "transmitted"), 0.0)
    mean_df = np.mean(grid)
    exposure = comfort_physics.seasonal_exposure(window, request.resolved_latitude, request.orientation_deg,
                                                depth, tilt, enabled)
    values = comfort_physics.performance_values(window, request.window_to_wall_ratio, shading, gain,
        passing, penetration, np.min(grid) / mean_df if mean_df > 0 else 0.0, exposure)
    fields = dict(
        score_report=scoring_engine.evaluate(values, report=True),
        solar_angles=Angles(summer_noon_alt=summer.altitude, summer_noon_az=summer.azimuth,
                            winter_noon_alt=winter.altitude, winter_noon_az=winter.azimuth),
        metrics=Metrics(summer_shading_rate=shading, winter_solar_gain_rate=gain,
                        daylight_compliance_rate=passing, is_gb_compliant=passing >= scene.AREA_TARGET,
                        winter_penetration_m=penetration),
        svg_rays=Section(summer_incident=summer.slope is not None, winter_incident=winter.slope is not None,
                         summer_blocked=summer.slope is not None and shading == 1,
                         winter_hit_depth=penetration, summer=summer_rays, winter=winter_rays),
    )
    if include_heatmap:
        return SimulationResult(**fields, heatmap_grid=grid.tolist())
    return SimulationSummary(**fields)
