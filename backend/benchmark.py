"""Run with python -m benchmark from the repository root."""

import platform
from time import perf_counter_ns

import fastapi
import numpy as np
from fastapi.testclient import TestClient

from suncraft.api import app
from suncraft.optimization import optimize
from suncraft.schemas import SimulationInput
from suncraft.simulation import simulate


def measure(label, action):
    for _ in range(10):
        action()
    samples = []
    for _ in range(100):
        start = perf_counter_ns()
        action()
        samples.append((perf_counter_ns() - start) / 1_000_000)
    p50, p95 = np.percentile(samples, [50, 95])
    print(f"{label:25s} p50 {p50:7.2f} ms   p95 {p95:7.2f} ms")


def main():
    request = SimulationInput(city="shanghai")
    print(f"Python {platform.python_version()}, NumPy {np.__version__}, FastAPI {fastapi.__version__}")
    measure("simulate / engine", lambda: simulate(request))
    measure("optimize / engine", lambda: optimize(request))
    with TestClient(app) as client:
        def call(path):
            response = client.post(path, json={"city": "shanghai"})
            response.raise_for_status()
            response.json()
        measure("simulate / ASGI", lambda: call("/api/simulate"))
        measure("optimize / ASGI", lambda: call("/api/optimize"))


if __name__ == "__main__":
    main()
