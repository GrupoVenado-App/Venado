from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import Reponedor, Ruta, Visita
from app.schemas import OptimizarRequest
from app.services.geocalc import haversine_meters, traslado_minutos
from app.services.optimizador import optimizar_rutas
from app.services.openrouteservice import get_ors_route_geometry


router = APIRouter(prefix="/rutas", tags=["rutas"])


def serialize_ruta(ruta: Ruta) -> dict:
    visitas = sorted(ruta.visitas, key=lambda item: item.orden_planificado)
    return {
        "id": str(ruta.id),
        "reponedor_id": str(ruta.reponedor_id),
        "reponedor": {
            "id": str(ruta.reponedor.id),
            "nombre": ruta.reponedor.nombre,
            "supervisor": ruta.reponedor.supervisor,
        }
        if ruta.reponedor
        else None,
        "fecha": ruta.fecha.isoformat(),
        "dia_semana": ruta.dia_semana,
        "estado": ruta.estado.value,
        "distancia_total_km": ruta.distancia_total_km,
        "tiempo_total_estimado_min": ruta.tiempo_total_estimado_min,
        "tiempo_total_real_min": ruta.tiempo_total_real_min,
        "pdvs_ordenados": ruta.pdvs_ordenados,
        "visitas": [
            {
                "id": str(visita.id),
                "orden_planificado": visita.orden_planificado,
                "estado": visita.estado.value,
                "hora_inicio_real": visita.hora_inicio_real.isoformat() if visita.hora_inicio_real else None,
                "hora_fin_real": visita.hora_fin_real.isoformat() if visita.hora_fin_real else None,
                "tiempo_ejecucion_min": visita.tiempo_ejecucion_min,
                "distancia_desde_anterior_km": visita.distancia_desde_anterior_km,
                "tiempo_traslado_desde_anterior_min": visita.tiempo_traslado_desde_anterior_min,
                "pdv": {
                    "id": str(visita.pdv.id),
                    "codigo": visita.pdv.codigo,
                    "nombre": visita.pdv.nombre,
                    "mercado": visita.pdv.mercado,
                    "tipo_cliente": visita.pdv.tipo_cliente.value,
                    "latitud": visita.pdv.latitud,
                    "longitud": visita.pdv.longitud,
                    "tiempo_visita_estimado_min": visita.pdv.tiempo_visita_estimado_min,
                },
            }
            for visita in visitas
        ],
    }


@router.post("/optimizar")
def optimizar(
    payload: OptimizarRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    try:
        rutas = optimizar_rutas(db, payload.pdv_ids, payload.reponedor_ids, payload.fecha, payload.criterio)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "fecha": payload.fecha.isoformat(),
        "criterio": payload.criterio,
        "rutas": [serialize_ruta(ruta) for ruta in rutas],
        "resumen": {
            "rutas_creadas": len(rutas),
            "pdvs_asignados": sum(len(ruta.visitas) for ruta in rutas),
            "km_totales": round(sum(ruta.distancia_total_km for ruta in rutas), 2),
            "tiempo_total_min": sum(ruta.tiempo_total_estimado_min for ruta in rutas),
        },
    }


@router.get("/mis-rutas")
def mis_rutas(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    user: Reponedor = Depends(require_role("reponedor")),
) -> list[dict]:
    target = fecha or date.today()
    rutas = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.reponedor_id == user.id, Ruta.fecha == target)
        .order_by(Ruta.created_at.desc())
        .all()
    )
    return [serialize_ruta(ruta) for ruta in rutas]


@router.get("/por-reponedor/{reponedor_id}")
def ruta_por_reponedor(
    reponedor_id: UUID,
    fecha: date,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[dict]:
    rutas = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.reponedor_id == reponedor_id, Ruta.fecha == fecha)
        .order_by(Ruta.created_at.desc())
        .all()
    )
    return [serialize_ruta(ruta) for ruta in rutas]


@router.get("")
def list_rutas(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    query = db.query(Ruta).options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
    if fecha:
        query = query.filter(Ruta.fecha == fecha)
    return [serialize_ruta(ruta) for ruta in query.order_by(Ruta.fecha.desc(), Ruta.created_at.desc()).limit(200).all()]


@router.get("/geometria-punto-a-punto")
def geometria_punto_a_punto(
    olat: float = Query(..., description="Latitud origen"),
    olng: float = Query(..., description="Longitud origen"),
    dlat: float = Query(..., description="Latitud destino"),
    dlng: float = Query(..., description="Longitud destino"),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> dict:
    """Return ORS road geometry from an arbitrary origin to a destination.
    Used to draw the live navigation route from the reponedor's current location.
    """
    road_coords = get_ors_route_geometry([(olng, olat), (dlng, dlat)])
    coords = road_coords if road_coords else [[olng, olat], [dlng, dlat]]
    # Also compute estimated travel time
    from app.services.openrouteservice import estimate_leg
    leg = estimate_leg(olng, olat, dlng, dlat)
    if leg["distancia_km"] is None:
        distancia_km = haversine_meters(olat, olng, dlat, dlng) / 1000
        leg = {
            "distancia_km": round(distancia_km, 2),
            "duracion_min": max(1, round(traslado_minutos(distancia_km))),
            "fuente": "LOCAL",
        }
    return {
        "ors_geometry": road_coords is not None,
        "geometry": {"type": "LineString", "coordinates": coords},
        "distancia_km": leg["distancia_km"],
        "duracion_min": leg["duracion_min"],
        "fuente": leg.get("fuente", "LOCAL"),
    }


@router.get("/{ruta_id}")
def get_ruta(
    ruta_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> dict:
    ruta = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.id == ruta_id)
        .one_or_none()
    )
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    return serialize_ruta(ruta)


@router.get("/{ruta_id}/geometria")
def geometria_ruta(
    ruta_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> dict:
    """Return the ORS road geometry (GeoJSON) for a specific route.
    Falls back to straight-line coordinates if ORS is unavailable.
    """
    ruta = (
        db.query(Ruta)
        .options(joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.id == ruta_id)
        .one_or_none()
    )
    if not ruta:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    ordered = sorted(ruta.visitas, key=lambda v: v.orden_planificado)
    waypoints = [(v.pdv.longitud, v.pdv.latitud) for v in ordered]
    road_coords = get_ors_route_geometry(waypoints)
    coords = road_coords if road_coords else [[lng, lat] for lng, lat in waypoints]
    return {
        "ruta_id": str(ruta_id),
        "ors_geometry": road_coords is not None,
        "geometry": {"type": "LineString", "coordinates": coords},
    }
