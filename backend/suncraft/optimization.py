"""Feasibility first, then an exact two-objective Pareto sweep on the discrete grid."""

from functools import lru_cache

import numpy as np

from . import daylight, scene, solar
from .schemas import EvaluatedDesign, OptimizationResult, OptimizationWithSimulation, SearchStats, SimulationInput
from .simulation import simulate


DEPTHS = np.round(np.linspace(0, scene.MAX_OVERHANG, 41), 2)
TILTS = np.arange(25) * scene.MAX_TILT / 24
GRID_DEPTH = np.repeat(DEPTHS, TILTS.size)
GRID_TILT = np.tile(TILTS, DEPTHS.size)


@lru_cache(maxsize=32)
def grid_compliance(window):
    # Thin depth and tilt axes broadcast over 32 sky directions. The same
    # diffuse field applies across cities and orientations for a given window.
    transmission = daylight.diffuse_transmission(window, DEPTHS[:, None], TILTS[None, :])
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


def optimize(request: SimulationInput, *, include_simulation: bool = False) -> OptimizationResult:
    window = scene.Window.from_ratio(request.window_to_wall_ratio)
    suns = solar.solstices(request.resolved_latitude, request.orientation_deg)
    before = EvaluatedDesign(parameters=request, metrics=simulate(request, include_heatmap=False).metrics)
    depth, tilt = GRID_DEPTH, GRID_TILT
    compliance = grid_compliance(window)
    if not np.any((depth == request.overhang_depth_m) & (tilt == request.louver_tilt_deg)):
        # Evaluate only the extra candidate. Never append to the cached arrays in place.
        compliance = np.append(compliance, before.metrics.daylight_compliance_rate)
        depth = np.append(depth, request.overhang_depth_m)
        tilt = np.append(tilt, request.louver_tilt_deg)
    shading, gain = solar.direct_rates(window, suns, depth, tilt)
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

    # Both objectives are fractions on the same scale. Closest to the ideal (1, 1).
    distance = (1 - shading[front])**2 + (1 - gain[front])**2
    ranking = np.lexsort((tilt[front], depth[front], -compliance[front], distance))
    best = front[ranking[0]]
    parameters = request.model_copy(update={"overhang_depth_m": float(depth[best]),
                                            "louver_tilt_deg": float(tilt[best])})
    recommended = simulate(parameters, include_heatmap=include_simulation)
    after = EvaluatedDesign(parameters=parameters, metrics=recommended.metrics)
    if include_simulation:
        return OptimizationWithSimulation(status="optimal", before=before, after=after, search=stats,
                                          simulation=recommended)
    return OptimizationResult(status="optimal", before=before, after=after, search=stats)
