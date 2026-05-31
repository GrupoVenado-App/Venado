import math
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import EjecucionMicroTarea, HistorialTiempo, MicroTarea, Ruta, RutaEstado, Visita, VisitaEstado
from app.schemas import LocationIn
from app.services.geocalc import DEPOT_LAT, DEPOT_LNG, haversine_meters, point_from_lng_lat
from app.services.openrouteservice import estimate_leg, get_ors_route_geometry


router = APIRouter(prefix="/visitas", tags=["visitas"])


def get_visita_or_404(db: Session, visita_id: UUID) -> Visita:
    visita = (
        db.query(Visita)
        .options(joinedload(Visita.pdv), joinedload(Visita.ruta), joinedload(Visita.ejecuciones))
        .filter(Visita.id == visita_id)
        .one_or_none()
    )
    if not visita:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    return visita


def distance_to_pdv_meters(db: Session, visita: Visita, latitud: float, longitud: float) -> float:
    try:
        meters = db.execute(
            text(
                """
                SELECT ST_DistanceSphere(
                    ST_MakePoint(:lng, :lat),
                    ST_MakePoint(:pdv_lng, :pdv_lat)
                ) AS meters
                """
            ),
            {
                "lng": longitud,
                "lat": latitud,
                "pdv_lng": visita.pdv.longitud,
                "pdv_lat": visita.pdv.latitud,
            },
        ).scalar_one()
        return float(meters)
    except Exception:
        return haversine_meters(latitud, longitud, visita.pdv.latitud, visita.pdv.longitud)


def update_historial_from_visit(db: Session, visita: Visita) -> None:
    tareas = (
        db.query(EjecucionMicroTarea)
        .options(joinedload(EjecucionMicroTarea.micro_tarea))
        .filter(EjecucionMicroTarea.visita_id == visita.id)
        .all()
    )
    if not tareas:
        return

    minutes_per_task = max(1, math.ceil((visita.tiempo_ejecucion_min or 1) / len(tareas)))
    today = date.today()
    week = int(today.strftime("%V"))
    for ejecucion in tareas:
        sample = ejecucion.tiempo_real_min or minutes_per_task
        latest = (
            db.query(HistorialTiempo)
            .filter(
                HistorialTiempo.micro_tarea_id == ejecucion.micro_tarea_id,
                HistorialTiempo.pdv_tipo_cliente == visita.pdv.tipo_cliente,
            )
            .order_by(HistorialTiempo.fecha_calculo.desc())
            .first()
        )
        if latest and latest.fecha_calculo == today:
            total = latest.tiempo_promedio_real_min * latest.cantidad_muestras + sample
            latest.cantidad_muestras += 1
            latest.tiempo_promedio_real_min = round(total / latest.cantidad_muestras, 2)
        else:
            db.add(
                HistorialTiempo(
                    micro_tarea_id=ejecucion.micro_tarea_id,
                    pdv_tipo_cliente=visita.pdv.tipo_cliente,
                    tiempo_promedio_real_min=float(sample),
                    cantidad_muestras=1,
                    fecha_calculo=today,
                    semana_anio=week,
                )
            )


def serialize_visita(visita: Visita) -> dict:
    return {
        "id": str(visita.id),
        "ruta_id": str(visita.ruta_id),
        "pdv_id": str(visita.pdv_id),
        "orden_planificado": visita.orden_planificado,
        "estado": visita.estado.value,
        "hora_inicio_real": visita.hora_inicio_real.isoformat() if visita.hora_inicio_real else None,
        "hora_fin_real": visita.hora_fin_real.isoformat() if visita.hora_fin_real else None,
        "tiempo_ejecucion_min": visita.tiempo_ejecucion_min,
        "hora_inicio_traslado": visita.hora_inicio_traslado.isoformat() if visita.hora_inicio_traslado else None,
        "hora_fin_traslado": visita.hora_fin_traslado.isoformat() if visita.hora_fin_traslado else None,
        "tiempo_traslado_real_min": visita.tiempo_traslado_real_min,
        "distancia_desde_anterior_km": visita.distancia_desde_anterior_km,
        "tiempo_traslado_desde_anterior_min": visita.tiempo_traslado_desde_anterior_min,
        "ors_distancia_desde_anterior_km": visita.ors_distancia_desde_anterior_km,
        "ors_tiempo_traslado_desde_anterior_min": visita.ors_tiempo_traslado_desde_anterior_min,
        "traslado_fuente": visita.traslado_fuente,
        "foto_url": visita.foto_url,
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


@router.get("/{visita_id}")
def detalle_visita(
    visita_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> dict:
    return serialize_visita(get_visita_or_404(db, visita_id))


@router.post("/{visita_id}/iniciar")
def iniciar_visita(
    visita_id: UUID,
    payload: LocationIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    visita = get_visita_or_404(db, visita_id)
    if visita.hora_inicio_real:
        raise HTTPException(status_code=400, detail="La visita ya fue iniciada")
    if visita.estado not in (VisitaEstado.PENDIENTE, VisitaEstado.EN_TRASLADO):
        raise HTTPException(status_code=400, detail="La visita no esta disponible para iniciar")

    distance_m = distance_to_pdv_meters(db, visita, payload.latitud, payload.longitud)
    if distance_m > 200:
        raise HTTPException(status_code=400, detail=f"Estas a {distance_m:.0f} metros del PDV. Acercate para iniciar.")

    now = datetime.now(UTC)
    visita.hora_inicio_real = now
    visita.coordenada_checkin = point_from_lng_lat(payload.longitud, payload.latitud)
    visita.estado = VisitaEstado.EN_PROGRESO
    # Save travel time from chronometer or simulation
    if payload.tiempo_traslado_real_min is not None or visita.hora_inicio_traslado:
        travel_min = payload.tiempo_traslado_real_min
        if travel_min is None and visita.hora_inicio_traslado:
            travel_min = max(1, math.ceil((now - visita.hora_inicio_traslado).total_seconds() / 60))
        visita.tiempo_traslado_real_min = travel_min
        if travel_min is not None and not visita.hora_inicio_traslado:
            visita.hora_inicio_traslado = now - timedelta(minutes=travel_min)
        visita.hora_fin_traslado = now
        if payload.origen_latitud is not None and payload.origen_longitud is not None:
            visita.coordenada_inicio_traslado = point_from_lng_lat(payload.origen_longitud, payload.origen_latitud)
        visita.coordenada_fin_traslado = point_from_lng_lat(payload.longitud, payload.latitud)
    if visita.ruta.estado == RutaEstado.PLANIFICADA:
        visita.ruta.estado = RutaEstado.EN_EJECUCION
    db.commit()
    return {"ok": True, "estado": visita.estado.value, "distancia_m": round(distance_m, 1), "hora_inicio": now.isoformat()}


@router.post("/{visita_id}/iniciar-traslado")
def iniciar_traslado(
    visita_id: UUID,
    payload: LocationIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    visita = get_visita_or_404(db, visita_id)
    if visita.hora_inicio_real:
        raise HTTPException(status_code=400, detail="La visita ya fue iniciada")
    if visita.hora_inicio_traslado:
        return {
            "ok": True,
            "estado": visita.estado.value,
            "hora_inicio_traslado": visita.hora_inicio_traslado.isoformat(),
        }

    now = datetime.now(UTC)
    visita.hora_inicio_traslado = now
    visita.coordenada_inicio_traslado = point_from_lng_lat(payload.longitud, payload.latitud)
    visita.estado = VisitaEstado.EN_TRASLADO
    if visita.ruta.estado == RutaEstado.PLANIFICADA:
        visita.ruta.estado = RutaEstado.EN_EJECUCION
    db.commit()
    return {"ok": True, "estado": visita.estado.value, "hora_inicio_traslado": now.isoformat()}


@router.post("/{visita_id}/finalizar")
def finalizar_visita(
    visita_id: UUID,
    payload: LocationIn,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    visita = get_visita_or_404(db, visita_id)
    if not visita.hora_inicio_real:
        raise HTTPException(status_code=400, detail="La visita aun no fue iniciada")
    if visita.estado == VisitaEstado.COMPLETADA:
        raise HTTPException(status_code=400, detail="La visita ya fue completada")

    now = datetime.now(UTC)
    elapsed = max(1, math.ceil((now - visita.hora_inicio_real).total_seconds() / 60))
    visita.hora_fin_real = now
    visita.coordenada_checkout = point_from_lng_lat(payload.longitud, payload.latitud)
    visita.tiempo_ejecucion_min = elapsed
    visita.estado = VisitaEstado.COMPLETADA
    update_historial_from_visit(db, visita)

    # ── Calcular tramo ORS desde el PDV anterior (o depósito) ──────────────────
    if visita.traslado_fuente != "ORS":  # only when not already filled by optimiser
        all_visits = (
            db.query(Visita)
            .filter(Visita.ruta_id == visita.ruta_id)
            .order_by(Visita.orden_planificado)
            .all()
        )
        prev_visit = next(
            (v for v in reversed(all_visits) if v.orden_planificado < visita.orden_planificado),
            None,
        )
        if prev_visit:
            origin_lng, origin_lat = prev_visit.pdv.longitud, prev_visit.pdv.latitud
        else:
            origin_lng, origin_lat = DEPOT_LNG, DEPOT_LAT
        leg = estimate_leg(origin_lng, origin_lat, visita.pdv.longitud, visita.pdv.latitud)
        if leg["distancia_km"] is not None:
            visita.ors_distancia_desde_anterior_km = leg["distancia_km"]
            visita.ors_tiempo_traslado_desde_anterior_min = leg["duracion_min"]
            visita.traslado_fuente = "ORS"
    # ─────────────────────────────────────────────────────────────────────────

    remaining = (
        db.query(Visita)
        .filter(Visita.ruta_id == visita.ruta_id, Visita.id != visita.id, Visita.estado != VisitaEstado.COMPLETADA)
        .count()
    )
    if remaining == 0:
        visita.ruta.estado = RutaEstado.COMPLETADA
        visita.ruta.tiempo_total_real_min = sum(
            item.tiempo_ejecucion_min or 0 for item in db.query(Visita).filter(Visita.ruta_id == visita.ruta_id).all()
        )

    db.commit()
    return {"ok": True, "estado": visita.estado.value, "tiempo_ejecucion_min": elapsed, "hora_fin": now.isoformat()}


@router.get("/{visita_id}/micro-tareas")
def micro_tareas_visita(
    visita_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[dict]:
    visita = get_visita_or_404(db, visita_id)
    if not visita.ejecuciones:
        tareas = db.query(MicroTarea).filter(MicroTarea.tipo_cliente == visita.pdv.tipo_cliente).all()
        for tarea in tareas:
            db.add(EjecucionMicroTarea(visita_id=visita.id, micro_tarea_id=tarea.id))
        db.commit()

    ejecuciones = (
        db.query(EjecucionMicroTarea)
        .options(joinedload(EjecucionMicroTarea.micro_tarea))
        .filter(EjecucionMicroTarea.visita_id == visita_id)
        .all()
    )
    return [
        {
            "id": str(item.id),
            "visita_id": str(item.visita_id),
            "micro_tarea_id": str(item.micro_tarea_id),
            "nombre": item.micro_tarea.nombre,
            "marca": item.micro_tarea.marca,
            "tiempo_estimado_minutos": item.micro_tarea.tiempo_estimado_minutos,
            "hora_inicio": item.hora_inicio.isoformat() if item.hora_inicio else None,
            "hora_fin": item.hora_fin.isoformat() if item.hora_fin else None,
            "tiempo_real_min": item.tiempo_real_min,
            "completada": item.completada,
            "foto_evidencia_url": item.foto_evidencia_url,
        }
        for item in ejecuciones
    ]
