"""Feasibility first, then an exact two-objective Pareto sweep on the discrete grid."""

import numpy as np

from . import daylight, scene, solar
from .schemas import EvaluatedDesign, OptimizationResult, SearchStats, SimulationInput
from .simulation import simulate


def candidate_grid(request):
    depths = np.arange(41) * scene.MAX_OVERHANG / 40
    tilts = np.arange(25) * scene.MAX_TILT / 24
    depth, tilt = (grid.ravel() for grid in np.meshgrid(depths, tilts, indexing="ij"))
    # Keep an off-grid starting design eligible on exactly the same terms.
    if not np.any((depth == request.overhang_depth_m) & (tilt == request.louver_tilt_deg)):
        depth = np.append(depth, request.overhang_depth_m)
        tilt = np.append(tilt, request.louver_tilt_deg)
    return depth, tilt


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


def optimize(request: SimulationInput) -> OptimizationResult:
    window = scene.Window.from_ratio(request.window_to_wall_ratio)
    suns = solar.solstices(request.resolved_latitude, request.orientation_deg)
    depth, tilt = candidate_grid(request)
    shading, gain = solar.direct_rates(window, suns, depth, tilt)
    transmission = daylight.diffuse_transmission(window, depth, tilt)
    compliance = daylight.compliance_rates(daylight.unshaded_grid(window), transmission)
    front = pareto_indices(shading, gain, compliance, depth, tilt)
    stats = SearchStats(candidate_count=depth.size,
                        feasible_count=np.count_nonzero(compliance >= scene.AREA_TARGET),
                        pareto_objective_count=front.size,
                        max_daylight_compliance_rate=np.max(compliance))
    before = EvaluatedDesign(parameters=request, metrics=simulate(request).metrics)
    if not front.size:
        return OptimizationResult(status="infeasible", reason="daylight_target_unreachable",
                                  before=before, after=None, search=stats)

    # Both objectives are fractions on the same scale. Closest to the ideal (1, 1).
    distance = (1 - shading[front])**2 + (1 - gain[front])**2
    ranking = np.lexsort((tilt[front], depth[front], -compliance[front], distance))
    best = front[ranking[0]]
    parameters = request.model_copy(update={"overhang_depth_m": float(depth[best]),
                                            "louver_tilt_deg": float(tilt[best])})
    after = EvaluatedDesign(parameters=parameters, metrics=simulate(parameters).metrics)
    return OptimizationResult(status="optimal", before=before, after=after, search=stats)
