from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    EjecucionMicroTarea,
    HistorialTiempo,
    MicroTarea,
    PDV,
    Reponedor,
    Ruta,
    RutaEstado,
    TipoCliente,
    Visita,
)
from app.services.geocalc import DEPOT_LAT, DEPOT_LNG, dia_semana_es, haversine_meters, traslado_minutos

MAX_ROUTE_MINUTES = 480


@dataclass
class RouteStop:
    pdv: PDV
    orden: int
    distancia_desde_anterior_km: float
    tiempo_traslado_desde_anterior_min: int
    tiempo_estimado_llegada_min: int
    tiempo_ejecucion_min: int


@dataclass
class OptimizedVehicleRoute:
    reponedor: Reponedor
    stops: list[RouteStop]
    distancia_total_km: float
    tiempo_total_min: int


def _latest_historial_by_type(db: Session) -> dict[TipoCliente, float]:
    latest_rows = (
        db.query(
            HistorialTiempo.pdv_tipo_cliente,
            HistorialTiempo.micro_tarea_id,
            func.max(HistorialTiempo.fecha_calculo).label("fecha_calculo"),
        )
        .group_by(HistorialTiempo.pdv_tipo_cliente, HistorialTiempo.micro_tarea_id)
        .subquery()
    )
    rows = (
        db.query(
            HistorialTiempo.pdv_tipo_cliente,
            func.sum(HistorialTiempo.tiempo_promedio_real_min).label("total_min"),
        )
        .join(
            latest_rows,
            (HistorialTiempo.pdv_tipo_cliente == latest_rows.c.pdv_tipo_cliente)
            & (HistorialTiempo.micro_tarea_id == latest_rows.c.micro_tarea_id)
            & (HistorialTiempo.fecha_calculo == latest_rows.c.fecha_calculo),
        )
        .group_by(HistorialTiempo.pdv_tipo_cliente)
        .all()
    )
    return {row.pdv_tipo_cliente: float(row.total_min) for row in rows}


def _distance_matrix(pdvs: list[PDV]) -> tuple[list[list[float]], list[list[float]]]:
    points = [(DEPOT_LAT, DEPOT_LNG)] + [(pdv.latitud, pdv.longitud) for pdv in pdvs]
    n = len(points)
    distances_km = [[0.0 for _ in range(n)] for _ in range(n)]
    travel_min = [[0.0 for _ in range(n)] for _ in range(n)]
    for i, (lat1, lng1) in enumerate(points):
        for j, (lat2, lng2) in enumerate(points):
            if i == j:
                continue
            km = haversine_meters(lat1, lng1, lat2, lng2) / 1000
            distances_km[i][j] = km
            travel_min[i][j] = traslado_minutos(km)
    return distances_km, travel_min


def _build_route_from_nodes(
    reponedor: Reponedor,
    pdvs: list[PDV],
    node_ids: list[int],
    distances_km: list[list[float]],
    travel_min: list[list[float]],
    execution_times: list[int],
) -> OptimizedVehicleRoute:
    stops: list[RouteStop] = []
    prev_node = 0
    elapsed = 0
    total_distance = 0.0
    total_time = 0
    for order, node in enumerate(node_ids, start=1):
        pdv = pdvs[node - 1]
        distance = distances_km[prev_node][node]
        travel = int(round(travel_min[prev_node][node]))
        service = int(round(execution_times[node]))
        elapsed += travel
        stops.append(
            RouteStop(
                pdv=pdv,
                orden=order,
                distancia_desde_anterior_km=round(distance, 2),
                tiempo_traslado_desde_anterior_min=travel,
                tiempo_estimado_llegada_min=elapsed,
                tiempo_ejecucion_min=service,
            )
        )
        elapsed += service
        total_distance += distance
        total_time += travel + service
        prev_node = node

    if node_ids:
        total_distance += distances_km[prev_node][0]
        total_time += int(round(travel_min[prev_node][0]))

    return OptimizedVehicleRoute(
        reponedor=reponedor,
        stops=stops,
        distancia_total_km=round(total_distance, 2),
        tiempo_total_min=int(total_time),
    )


def _solve_with_ortools(
    reponedores: list[Reponedor],
    pdvs: list[PDV],
    distances_km: list[list[float]],
    travel_min: list[list[float]],
    execution_times: list[int],
) -> list[OptimizedVehicleRoute] | None:
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except Exception:
        return None

    node_count = len(pdvs) + 1
    vehicle_count = len(reponedores)
    manager = pywrapcp.RoutingIndexManager(node_count, vehicle_count, 0)
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(round((travel_min[from_node][to_node] + execution_times[to_node]) * 100))

    transit_callback = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback)
    routing.AddDimensionWithVehicleCapacity(
        transit_callback,
        0,
        [MAX_ROUTE_MINUTES * 100] * vehicle_count,
        True,
        "Tiempo",
    )
    time_dimension = routing.GetDimensionOrDie("Tiempo")
    time_dimension.SetGlobalSpanCostCoefficient(80)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(15)

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return None

    routes: list[OptimizedVehicleRoute] = []
    for vehicle_index, reponedor in enumerate(reponedores):
        index = routing.Start(vehicle_index)
        nodes: list[int] = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                nodes.append(node)
            index = solution.Value(routing.NextVar(index))
        if nodes:
            routes.append(_build_route_from_nodes(reponedor, pdvs, nodes, distances_km, travel_min, execution_times))
    return routes


def _kmeans_fallback(
    reponedores: list[Reponedor],
    pdvs: list[PDV],
    distances_km: list[list[float]],
    travel_min: list[list[float]],
    execution_times: list[int],
) -> list[OptimizedVehicleRoute]:
    if not pdvs:
        return []

    k = min(len(reponedores), len(pdvs))
    sorted_pdvs = sorted(enumerate(pdvs, start=1), key=lambda item: (item[1].latitud, item[1].longitud, item[1].codigo))
    centroids = [
        (sorted_pdvs[min(i * len(sorted_pdvs) // k, len(sorted_pdvs) - 1)][1].latitud,
         sorted_pdvs[min(i * len(sorted_pdvs) // k, len(sorted_pdvs) - 1)][1].longitud)
        for i in range(k)
    ]

    clusters: list[list[int]] = [[] for _ in range(k)]
    for _ in range(12):
        clusters = [[] for _ in range(k)]
        for node, pdv in sorted_pdvs:
            best = min(
                range(k),
                key=lambda idx: haversine_meters(pdv.latitud, pdv.longitud, centroids[idx][0], centroids[idx][1]),
            )
            clusters[best].append(node)
        for idx, cluster in enumerate(clusters):
            if cluster:
                lat = sum(pdvs[node - 1].latitud for node in cluster) / len(cluster)
                lng = sum(pdvs[node - 1].longitud for node in cluster) / len(cluster)
                centroids[idx] = (lat, lng)

    routes: list[OptimizedVehicleRoute] = []
    for idx, cluster in enumerate(clusters):
        remaining = set(cluster)
        current = 0
        ordered: list[int] = []
        while remaining:
            next_node = min(remaining, key=lambda node: distances_km[current][node])
            ordered.append(next_node)
            remaining.remove(next_node)
            current = next_node
        routes.append(_build_route_from_nodes(reponedores[idx], pdvs, ordered, distances_km, travel_min, execution_times))
    return [route for route in routes if route.stops]


def _persist_routes(db: Session, routes: list[OptimizedVehicleRoute], fecha: date) -> list[Ruta]:
    persisted: list[Ruta] = []
    dia = dia_semana_es(fecha)
    tareas_por_tipo: dict[TipoCliente, list[MicroTarea]] = {
        tipo: db.query(MicroTarea).filter(MicroTarea.tipo_cliente == tipo).all() for tipo in TipoCliente
    }

    for optimized in routes:
        pdvs_ordenados = [
            {
                "pdv_id": str(stop.pdv.id),
                "codigo": stop.pdv.codigo,
                "orden": stop.orden,
                "tiempo_estimado_llegada_min": stop.tiempo_estimado_llegada_min,
                "distancia_desde_anterior_km": stop.distancia_desde_anterior_km,
                "tiempo_traslado_desde_anterior_min": stop.tiempo_traslado_desde_anterior_min,
                "tiempo_ejecucion_min": stop.tiempo_ejecucion_min,
            }
            for stop in optimized.stops
        ]
        ruta = Ruta(
            reponedor_id=optimized.reponedor.id,
            fecha=fecha,
            dia_semana=dia,
            estado=RutaEstado.PLANIFICADA,
            distancia_total_km=optimized.distancia_total_km,
            tiempo_total_estimado_min=optimized.tiempo_total_min,
            pdvs_ordenados=pdvs_ordenados,
        )
        db.add(ruta)
        db.flush()

        for stop in optimized.stops:
            visita = Visita(
                ruta_id=ruta.id,
                pdv_id=stop.pdv.id,
                orden_planificado=stop.orden,
                distancia_desde_anterior_km=stop.distancia_desde_anterior_km,
                tiempo_traslado_desde_anterior_min=stop.tiempo_traslado_desde_anterior_min,
            )
            db.add(visita)
            db.flush()
            for tarea in tareas_por_tipo.get(stop.pdv.tipo_cliente, []):
                db.add(EjecucionMicroTarea(visita_id=visita.id, micro_tarea_id=tarea.id))

        persisted.append(ruta)
    db.commit()
    return (
        db.query(Ruta)
        .options(joinedload(Ruta.visitas).joinedload(Visita.pdv), joinedload(Ruta.reponedor))
        .filter(Ruta.id.in_([ruta.id for ruta in persisted]))
        .all()
    )


def optimizar_rutas(
    db: Session,
    pdv_ids: list[UUID],
    reponedor_ids: list[UUID],
    fecha: date,
    criterio: str = "MINIMIZAR_TIEMPO_TOTAL",
) -> list[Ruta]:
    if not pdv_ids:
        raise ValueError("Debe seleccionar al menos un PDV")
    if not reponedor_ids:
        raise ValueError("Debe seleccionar al menos un reponedor")

    pdvs = db.query(PDV).filter(PDV.id.in_(pdv_ids), PDV.activo.is_(True)).all()
    reponedores = db.query(Reponedor).filter(Reponedor.id.in_(reponedor_ids), Reponedor.activo.is_(True)).all()
    if len(pdvs) != len(set(pdv_ids)):
        raise ValueError("Uno o mas PDVs no existen o estan inactivos")
    if len(reponedores) != len(set(reponedor_ids)):
        raise ValueError("Uno o mas reponedores no existen o estan inactivos")

    pdv_order = {pdv_id: index for index, pdv_id in enumerate(pdv_ids)}
    rep_order = {rep_id: index for index, rep_id in enumerate(reponedor_ids)}
    pdvs.sort(key=lambda pdv: pdv_order[pdv.id])
    reponedores.sort(key=lambda rep: rep_order[rep.id])

    history_times = _latest_historial_by_type(db)
    execution_times = [0] + [
        int(round(history_times.get(pdv.tipo_cliente, pdv.tiempo_visita_estimado_min))) for pdv in pdvs
    ]
    distances_km, travel_min = _distance_matrix(pdvs)

    routes = _solve_with_ortools(reponedores, pdvs, distances_km, travel_min, execution_times)
    if routes is None:
        routes = _kmeans_fallback(reponedores, pdvs, distances_km, travel_min, execution_times)

    return _persist_routes(db, routes, fecha)
