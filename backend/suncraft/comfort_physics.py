"""Solstice time samples, occupied floor footprint, and a relative solar-load proxy."""

from functools import lru_cache

import numpy as np

from . import scene, solar

GLASS_SHGC = 0.55
SOFA_NEAR, SOFA_FAR, SOFA_WIDTH = 2.0, 3.8, 2.2
COOLING_WEIGHT, HEATING_WEIGHT = 0.70, 0.30


@lru_cache(maxsize=64)
def incident_profile(latitude, orientation, summer):
    """Facade-normal and lateral slopes on the lit side, with trapezoid weights in hours."""
    start, stop = (0, 24) if summer else (8, 16)
    hours = np.arange(start * 4, stop * 4 + 1) / 4
    weights = np.full(hours.size, 0.25)
    weights[[0, -1]] /= 2
    north_summer = summer == (latitude >= 0)
    dec = np.deg2rad(solar.OBLIQUITY if north_summer else -solar.OBLIQUITY)
    lat, az = np.deg2rad([latitude, orientation])
    hour_angle = np.deg2rad(15 * (hours - 12))
    east = -np.cos(dec) * np.sin(hour_angle)
    north = np.cos(lat) * np.sin(dec) - np.sin(lat) * np.cos(dec) * np.cos(hour_angle)
    up = np.sin(lat) * np.sin(dec) + np.cos(lat) * np.cos(dec) * np.cos(hour_angle)
    normal = east * np.sin(az) + north * np.cos(az)
    side = east * np.cos(az) - north * np.sin(az)
    lit = (up > solar.EPS) & (normal > solar.EPS)
    weights = weights[lit]
    irradiation = normal[lit] * weights
    if irradiation.size:
        irradiation /= irradiation.sum()
    return up[lit] / normal[lit], np.abs(side[lit] / normal[lit]), weights, irradiation


def seasonal_exposure(window, latitude, orientation, depth, tilt, louvers_enabled):
    depth, tilt = np.asarray(depth)[..., None], np.asarray(tilt)[..., None]
    orientation %= 360
    slope, _, weights, winter_flux = incident_profile(latitude, orientation, False)
    canopy, slat = solar.shade_lengths(depth, tilt, slope, louvers_enabled)
    # Full window means every point of the opening receives the direct beam.
    winter_hours = np.sum(((canopy == 0) & (slat == 0)) * weights, axis=-1)
    winter_open = np.sum(solar.clear_fraction(window, canopy, slat) * winter_flux, axis=-1)

    slope, side, weights, summer_flux = incident_profile(latitude, orientation, True)
    canopy, slat = solar.shade_lengths(depth, tilt, slope, louvers_enabled)
    summer_open = np.sum(solar.clear_fraction(window, canopy, slat) * summer_flux, axis=-1)
    # Both window and sofa are centred. Beyond this depth a sideways beam misses
    # the sofa even if its vertical section reaches the correct depth.
    span = (scene.WINDOW_WIDTH + SOFA_WIDTH) / 2
    far = np.minimum(SOFA_FAR, span / np.maximum(side, solar.EPS))
    near_down = np.maximum(0, window.head - far * slope)
    far_down = np.minimum(window.height, window.head - SOFA_NEAR * slope)
    possible = (far > SOFA_NEAR) & (far_down > near_down)
    weights = weights[possible]
    canopy = canopy[..., possible]
    slat = slat[..., possible] if louvers_enabled else 0.0
    top = np.maximum(near_down[possible], canopy)
    bottom = far_down[possible]
    clear = (solar.clear_length_above(bottom, slat)
             - solar.clear_length_above(np.minimum(top, bottom), slat))
    summer_hours = np.sum((clear > solar.EPS) * weights, axis=-1)
    # Fixed seasonal reference irradiation budgets, zero on an unlit facade.
    cooling = COOLING_WEIGHT if summer_flux.size else 0.0
    heating = HEATING_WEIGHT if winter_flux.size else 0.0
    reference = cooling * GLASS_SHGC + heating * (1 - GLASS_SHGC)
    savings = GLASS_SHGC * (cooling * 0.75 * (1 - summer_open) - heating * (1 - winter_open))
    relative = savings / reference if reference else np.zeros_like(summer_open)
    return winter_hours, summer_hours, relative


def performance_values(window, wwr, shading, gain, area_rate, penetration, uniformity, exposure,
                       summer_incident=True):
    winter_hours, sofa_hours, relative = exposure
    shgc = GLASS_SHGC * (1 - 0.75 * shading)
    return {
        "summer_shading_rate": shading, "wwr": wwr, "shgc": shgc,
        "summer_incident": summer_incident,
        "winter_solar_gain_rate": gain, "winter_penetration_m": penetration,
        "winter_full_window_hours": winter_hours, "daylight_compliance_rate": area_rate,
        "daylight_uniformity": uniformity,
        "window_floor_ratio": window.height * scene.WINDOW_WIDTH / (scene.WIDTH * scene.DEPTH),
        "sofa_summer_hours": sofa_hours, "relative_load_reduction": relative,
    }
