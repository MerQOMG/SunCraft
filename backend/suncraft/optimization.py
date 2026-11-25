"""Maximize the reported comfort score over the daylight-feasible design grid."""

from functools import lru_cache

import numpy as np

from . import comfort_physics, daylight, scene, scoring_engine, solar
from .schemas import EvaluatedDesign, OptimizationResult, OptimizationWithSimulation, SearchStats, SimulationInput
from .simulation import simulate


DEPTHS = np.round(np.linspace(0, scene.MAX_OVERHANG, 41), 2)
TILTS = np.arange(25) * scene.MAX_TILT / 24
# The studio sliders advance in 50 mm and 1 degree increments.
STUDIO_DEPTHS = np.arange(37) / 20
STUDIO_TILTS = np.arange(81)


def search_axes(studio):
    return (STUDIO_DEPTHS, STUDIO_TILTS) if studio else (DEPTHS, TILTS)


@lru_cache(maxsize=32)
def grid_compliance(window, louvers_enabled, studio=False):
    # Thin depth and tilt axes broadcast over 32 sky directions. The same
    # diffuse field applies across cities and orientations for a given window.
    depths, tilts = search_axes(studio)
    transmission = daylight.diffuse_transmission(window, depths[:, None], tilts[None, :], louvers_enabled)
    transmission = np.broadcast_to(transmission, (depths.size, tilts.size))
    rates = daylight.compliance_rates(daylight.unshaded_grid(window), transmission.ravel())
    rates.setflags(write=False)
    return rates


def pareto_indices(shading, gain, compliance, depth, tilt):
    eligible = np.flatnonzero(compliance >= scene.AREA_TARGET)
    if not eligible.size:
        return eligible
    # Sort by descending summer shading, then winter gain. Identical objective
    # pairs retain the most compliant, then shallowest, then least tilted design.
    order = eligible[np.lexsort((tilt[eligible], depth[eligible], -compliance[eligible],
                                 -gain[eligible], -shading[eligible]))]
    first_at_shading = np.r_[True, shading[order[1:]] != shading[order[:-1]]]
    best_at_shading = order[first_at_shading]
    best_gain = gain[best_at_shading]
    # At decreasing shading, a point survives only if gain strictly improves.
    previous_best = np.r_[-np.inf, np.maximum.accumulate(best_gain)[:-1]]
    return best_at_shading[best_gain > previous_best]


@lru_cache(maxsize=16)
def grid_performance(wwr, latitude, orientation, enabled, studio=False):
    window = scene.Window.from_ratio(wwr)
    suns = solar.solstices(latitude, orientation)
    depths, tilts = search_axes(studio)
    depth, tilt = depths[:, None], tilts[None, :]
    compliance = grid_compliance(window, enabled, studio).reshape(depths.size, tilts.size)
    shading, gain = solar.direct_rates(window, suns, depth, tilt, enabled)
    shading, gain = (np.broadcast_to(a, compliance.shape) for a in (shading, gain))
    penetration = solar.penetration(window, suns[1], depth, tilt, gain, enabled)
    base = daylight.unshaded_grid(window)
    # The common diffuse transmission cancels in min/mean for every feasible design.
    exposure = comfort_physics.seasonal_exposure(window, latitude, orientation, depth, tilt, enabled)
    values = comfort_physics.performance_values(window, wwr, shading, gain, compliance, penetration,
                                                base.min() / base.mean(), exposure)
    scores = scoring_engine.evaluate(values)
    result = tuple(a.ravel() for a in (shading, gain, compliance, scores))
    for array in result:
        array.setflags(write=False)
    return result


def optimize(request: SimulationInput, *, include_simulation: bool = False,
             studio: bool = False) -> OptimizationResult:
    summary = simulate(request, include_heatmap=False)
    before = EvaluatedDesign(parameters=request, metrics=summary.metrics, score_report=summary.score_report)
    depths, tilts = search_axes(studio)
    depth, tilt = np.repeat(depths, tilts.size), np.tile(tilts, depths.size)
    shading, gain, compliance, totals = grid_performance(
        request.window_to_wall_ratio, request.resolved_latitude, request.orientation_deg % 360,
        request.louvers_enabled, studio)
    if not np.any((depth == request.overhang_depth_m) & (tilt == request.louver_tilt_deg)):
        # Evaluate only the extra candidate. Never append to the cached arrays in place.
        compliance = np.append(compliance, before.metrics.daylight_compliance_rate)
        shading = np.append(shading, before.metrics.summer_shading_rate)
        gain = np.append(gain, before.metrics.winter_solar_gain_rate)
        totals = np.append(totals, before.score_report.total_score)
        depth = np.append(depth, request.overhang_depth_m)
        tilt = np.append(tilt, request.louver_tilt_deg)
    front = pareto_indices(shading, gain, compliance, depth, tilt)
    stats = SearchStats(candidate_count=depth.size,
                        feasible_count=np.count_nonzero(compliance >= scene.AREA_TARGET),
                        pareto_objective_count=front.size,
                        max_daylight_compliance_rate=np.max(compliance))
    if not front.size:
        fields = dict(status="infeasible", reason="daylight_target_unreachable",
                      before=before, after=None, search=stats)
        if include_simulation:
            return OptimizationWithSimulation(**fields, simulation=None)
        return OptimizationResult(**fields)

    eligible = np.flatnonzero(compliance >= scene.AREA_TARGET)
    current = (depth == request.overhang_depth_m) & (tilt == request.louver_tilt_deg)
    ranking = np.lexsort((tilt[eligible], depth[eligible], -compliance[eligible],
                          ~current[eligible], -totals[eligible]))
    best = eligible[ranking[0]]
    parameters = request.model_copy(update={"overhang_depth_m": float(depth[best]),
                                            "louver_tilt_deg": float(tilt[best])})
    recommended = simulate(parameters, include_heatmap=include_simulation)
    after = EvaluatedDesign(parameters=parameters, metrics=recommended.metrics,
                            score_report=recommended.score_report)
    if include_simulation:
        return OptimizationWithSimulation(status="optimal", before=before, after=after, search=stats,
                                          simulation=recommended)
    return OptimizationResult(status="optimal", before=before, after=after, search=stats)
