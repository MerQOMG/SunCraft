"""Fixed geometry, materials and parameter limits shared with the client."""

from dataclasses import dataclass

WIDTH = 5.4
DEPTH = 6.0
HEIGHT = 3.0
WINDOW_WIDTH = 4.86
SILL = 0.45
SLAT_CHORD = 0.06
SLAT_PITCH = 0.45
GRID_SIZE = 24
DF_THRESHOLD = 2.0
AREA_TARGET = 0.80
WWR_MIN, WWR_MAX = 0.10, 0.75
MAX_OVERHANG = 1.6
MAX_TILT = 75.0
DEFAULT_CITY = "shanghai"
DEFAULT_WWR = 0.50
DEFAULT_OVERHANG = 0.40
DEFAULT_TILT = 0.0
DEFAULT_ORIENTATION = 180.0

CITIES = {
    "shanghai": ("上海 / 同济", 31.2),
    "beijing": ("北京", 39.9),
    "guangzhou": ("广州", 23.1),
    "harbin": ("哈尔滨", 45.8),
}


@dataclass(frozen=True)
class Window:
    height: float

    @classmethod
    def from_ratio(cls, ratio: float) -> "Window":
        return cls(ratio * WIDTH * HEIGHT / WINDOW_WIDTH)

    @property
    def head(self) -> float:
        return SILL + self.height
