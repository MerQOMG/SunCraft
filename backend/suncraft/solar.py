"""Parallel horizontal shades. All section distances are normal to the facade."""

from dataclasses import dataclass
from math import cos, floor, hypot, radians, tan

import numpy as np

from . import scene
from .schemas import Ray
from .scene import Window

OBLIQUITY = 23.44
EPS = 1e-12


@dataclass(frozen=True)
class Sun:
    altitude: float
    azimuth: float | None
    slope: float | None  # Vertical drop per metre inward, or no incident beam


def noon_sun(latitude: float, declination: float, orientation: float) -> Sun:
    altitude = 90.0 - abs(latitude - declination)
    if abs(latitude - declination) < EPS:
        return Sun(altitude, None, None)  # Zenith: parallel to vertical glazing
    azimuth = 180.0 if latitude > declination else 0.0
    normal_factor = cos(radians(azimuth - orientation))
    if altitude <= EPS or normal_factor <= EPS:
        return Sun(altitude, azimuth, None)
    return Sun(altitude, azimuth, tan(radians(altitude)) / normal_factor)


def solstices(latitude: float, orientation: float) -> tuple[Sun, Sun]:
    summer_declination = OBLIQUITY if latitude >= 0 else -OBLIQUITY
    return (noon_sun(latitude, summer_declination, orientation),
            noon_sun(latitude, -summer_declination, orientation))


def shade_lengths(depth, tilt, slope):
    angle = np.deg2rad(tilt)
    return depth * slope, scene.SLAT_CHORD * (np.sin(angle) + np.cos(angle) * slope)


def clear_length_above(distance, slat_shadow):
    """Total clear length from head to distance, before applying the overhang."""
    pitch = scene.SLAT_PITCH
    shadow = np.minimum(pitch, slat_shadow)
    return np.floor(distance / pitch) * (pitch - shadow) + np.maximum(
        0, np.remainder(distance, pitch) - shadow
    )


def opening_fraction(window: Window, depth, tilt, slope):
    """Exact union of periodic slat shadows and the head-mounted canopy shadow."""
    canopy, slat = shade_lengths(depth, tilt, slope)
    clear = clear_length_above(window.height, slat) - clear_length_above(
        np.minimum(window.height, canopy), slat
    )
    return np.clip(clear / window.height, 0, 1)


def direct_rates(window: Window, suns: tuple[Sun, Sun], depth, tilt):
    summer, winter = suns
    zero = np.zeros_like(depth, dtype=float)
    shading = zero if summer.slope is None else 1 - opening_fraction(window, depth, tilt, summer.slope)
    gain = zero if winter.slope is None else opening_fraction(window, depth, tilt, winter.slope)
    return shading, gain


def section_rays(window: Window, sun: Sun, depth: float, tilt: float) -> list[Ray]:
    slope = sun.slope
    if slope is None:
        return []
    canopy, slat = shade_lengths(depth, tilt, slope)
    # Trace a short exterior segment along the same line, even at grazing incidence.
    dx = 0.50 / hypot(1, slope)

    def upstream(x, z):
        return (x - dx, z + dx * slope)

    rays = []
    blocked_sample = min(window.height, max(canopy, slat)) / 2
    if blocked_sample > 0:
        if blocked_sample <= canopy:
            outward = blocked_sample / slope
        else:
            outward = blocked_sample / (slope + tan(radians(tilt)))
        x = -outward
        z = window.head - blocked_sample + outward * slope
        rays.append(Ray(kind="blocked", start=upstream(x, z), end=(x, z)))

    if opening_fraction(window, depth, tilt, slope) > 0:
        # Upper limiting ray of the first clear interval below the canopy.
        cell_top = floor(canopy / scene.SLAT_PITCH) * scene.SLAT_PITCH
        entry_z = window.head - max(canopy, cell_top + slat)
        reach = min(scene.DEPTH, entry_z / slope)
        end = (reach, max(0.0, entry_z - reach * slope))
        rays.append(Ray(kind="transmitted", start=upstream(0, entry_z),
                        window_entry=(0, entry_z), end=end))
    return rays
