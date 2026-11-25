"""Uniform diffuse sky, clear rectangular aperture and one room-average reflection term."""

from functools import lru_cache

import numpy as np

from . import scene
from .solar import opening_fraction

GLASS_TRANSMITTANCE = 0.72
FLOOR_REFLECTANCE = 0.30
WALL_REFLECTANCE = 0.65
CEILING_REFLECTANCE = 0.80
FIRST_BOUNCE_REFLECTANCE = 0.45

# For an isotropic sky on a vertical facade the profile-angle weight is cos(phi).
# Midpoints in u = sin(phi) therefore carry equal diffuse illuminance.
_u = (np.arange(32) + 0.5) / 32
SKY_SLOPES = _u / np.sqrt(1 - _u**2)


@lru_cache(maxsize=32)
def unshaded_grid(window: scene.Window) -> np.ndarray:
    """DF in percent. Axis 0 is depth, axis 1 is transverse position."""
    n = scene.GRID_SIZE
    depth = ((np.arange(n) + 0.5) * scene.DEPTH / n)[:, None]
    lateral = ((np.arange(n) + 0.5) / n - 0.5) * scene.WIDTH
    left = -scene.WINDOW_WIDTH / 2 - lateral
    right = scene.WINDOW_WIDTH / 2 - lateral

    def edge_integral(height):
        radius = np.hypot(depth, height)
        return depth / (2 * radius) * (np.arctan(right / radius) - np.arctan(left / radius))

    # Integral of both projected cosines over the window divided by exterior E = pi*L.
    direct = (edge_integral(scene.SILL) - edge_integral(window.head)) / np.pi
    floor_area = scene.WIDTH * scene.DEPTH
    wall_area = 2 * (scene.WIDTH + scene.DEPTH) * scene.HEIGHT
    total_area = 2 * floor_area + wall_area
    glazing = window.height * scene.WINDOW_WIDTH
    mean_reflectance = ((WALL_REFLECTANCE * (wall_area - glazing)
                         + (FLOOR_REFLECTANCE + CEILING_REFLECTANCE) * floor_area)
                        / total_area)
    indirect = 0.5 * glazing / total_area * FIRST_BOUNCE_REFLECTANCE / (1 - mean_reflectance)
    grid = 100 * GLASS_TRANSMITTANCE * (direct + indirect)
    grid.setflags(write=False)
    return grid


def diffuse_transmission(window, depth, tilt, louvers_enabled=True):
    fraction = opening_fraction(window, np.asarray(depth)[..., None],
                                np.asarray(tilt)[..., None], SKY_SLOPES, louvers_enabled)
    return np.mean(fraction, axis=-1)


def compliance_rates(base_grid, transmission):
    """Find the first passing sorted DF for each transmission using exact products."""
    base = np.sort(base_grid, axis=None)
    low = np.zeros(np.shape(transmission), dtype=np.intp)
    high = np.full_like(low, base.size)
    while np.any(low < high):
        mid = (low + high) // 2
        passing = base[np.minimum(mid, base.size - 1)] * transmission >= scene.DF_THRESHOLD
        active = low < high
        high = np.where(active & passing, mid, high)
        low = np.where(active & ~passing, mid + 1, low)
    return (base.size - low) / base.size
