from __future__ import annotations

import math
from datetime import date

from geoalchemy2.shape import from_shape
from shapely.geometry import Point


DEPOT_LAT = -16.5000
DEPOT_LNG = -68.1193
URBAN_SPEED_KMH = 20.0


def point_from_lng_lat(longitud: float, latitud: float):
    return from_shape(Point(longitud, latitud), srid=4326)


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_m = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_m * c


def traslado_minutos(distancia_km: float) -> float:
    return (distancia_km / URBAN_SPEED_KMH) * 60


def dia_semana_es(fecha: date) -> str:
    dias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    return dias[fecha.weekday()]
