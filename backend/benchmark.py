"""Run python -m benchmark; --legacy measures the original two-request UI flow."""

import argparse
import platform
from time import perf_counter_ns

import fastapi
import numpy as np
from fastapi.testclient import TestClient

from suncraft.api import app
from suncraft.optimization import optimize
from suncraft.schemas import SimulationInput
from suncraft.simulation import simulate


def design(frame, moving_window):
    return {
        "city": "harbin",
        "window_to_wall_ratio": 0.41 + frame / 500 if moving_window else 0.50,
        "overhang_depth_m": (frame * 7 % 151) / 100,
        "louver_tilt_deg": (frame * 11 % 730) / 10,
    }


def measure(label, action, *, moving_window=False):
    samples, sizes = [], []
    for frame in range(110):
        payload = design(frame, moving_window)
        start = perf_counter_ns()
        size = action(payload)
        elapsed_ms = (perf_counter_ns() - start) / 1_000_000
        if frame >= 10:
            samples.append(elapsed_ms)
            sizes.append(size)
    p50, p95 = np.percentile(samples, [50, 95])
    print(f"{label:28s} {p50:7.3f} {p95:7.3f} {np.median(sizes):9.0f}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy", action="store_true", help="use original endpoints for drag and click")
    legacy = parser.parse_args().legacy
    print(f"Python {platform.python_version()}, NumPy {np.__version__}, FastAPI {fastapi.__version__}")
    print(f"{'path':28s} {'P50 ms':>7s} {'P95 ms':>7s} {'P50 bytes':>9s}")

    def engine(payload):
        optimize(SimulationInput(**payload))
        return 0

    def full_simulation(payload):
        simulate(SimulationInput(**payload))
        return 0

    measure("simulate + score / engine", full_simulation, moving_window=True)
    measure("optimize engine / fixed WWR", engine)
    measure("optimize engine / moving WWR", engine, moving_window=True)
    with TestClient(app) as client:
        def call(path, payload):
            response = client.post("/api/" + path, json=payload)
            response.raise_for_status()
            return response.json(), len(response.content)

        def click(payload):
            if legacy:
                result, size = call("optimize", payload)
                if result["after"] is not None:
                    _, draw_size = call("simulate", result["after"]["parameters"])
                    size += draw_size
                return size
            return call("optimize?include_simulation=true", payload)[1]

        drag_path = "simulate" if legacy else "simulate?include_heatmap=false"
        measure("drag / ASGI", lambda p: call(drag_path, p)[1])
        measure("heatmap / ASGI", lambda p: call("simulate", p)[1])
        measure("optimize + draw / fixed WWR", click)
        measure("optimize + draw / moving WWR", click, moving_window=True)


if __name__ == "__main__":
    main()
