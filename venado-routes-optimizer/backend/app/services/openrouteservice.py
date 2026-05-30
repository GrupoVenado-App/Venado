from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

from app.config import settings


@dataclass
class MatrixResult:
    distances_km: list[list[float]]
    durations_min: list[list[float]]
    source: str


def ors_enabled() -> bool:
    return bool(settings.ors_api_key)


def get_ors_matrix(locations_lng_lat: list[tuple[float, float]]) -> MatrixResult | None:
    if not settings.ors_api_key or len(locations_lng_lat) > settings.ors_matrix_max_locations:
        return None

    url = "https://api.openrouteservice.org/v2/matrix/driving-car"
    payload = {
        "locations": [[lng, lat] for lng, lat in locations_lng_lat],
        "metrics": ["distance", "duration"],
        "units": "m",
    }
    headers = {
        "Authorization": settings.ors_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    distances = data.get("distances")
    durations = data.get("durations")
    if not distances or not durations:
        return None

    return MatrixResult(
        distances_km=[
            [0.0 if value is None else round(float(value) / 1000, 3) for value in row]
            for row in distances
        ],
        durations_min=[
            [0.0 if value is None else max(1, float(value) / 60) for value in row]
            for row in durations
        ],
        source="ORS",
    )


def estimate_leg(origin_lng: float, origin_lat: float, dest_lng: float, dest_lat: float) -> dict:
    matrix = get_ors_matrix([(origin_lng, origin_lat), (dest_lng, dest_lat)])
    if matrix:
        return {
            "distancia_km": matrix.distances_km[0][1],
            "duracion_min": int(math.ceil(matrix.durations_min[0][1])),
            "fuente": matrix.source,
        }
    return {"distancia_km": None, "duracion_min": None, "fuente": "LOCAL"}
