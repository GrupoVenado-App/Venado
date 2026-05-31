from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import PDV, EjecucionMicroTarea, Reponedor, Ruta, RutaEstado, Visita, VisitaEstado
from app.services.openrouteservice import get_ors_route_geometry


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/resumen-hoy")
def resumen_hoy(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    target = fecha or date.today()
    total_planificados = db.query(Visita).join(Ruta).filter(Ruta.fecha == target).count()
    completadas = db.query(Visita).join(Ruta).filter(Ruta.fecha == target, Visita.estado == VisitaEstado.COMPLETADA).count()
    en_progreso = db.query(Visita).join(Ruta).filter(Ruta.fecha == target, Visita.estado == VisitaEstado.EN_PROGRESO).count()
    km_totales = db.query(func.coalesce(func.sum(Ruta.distancia_total_km), 0)).filter(Ruta.fecha == target).scalar()
    tiempo_real = (
        db.query(func.coalesce(func.sum(Visita.tiempo_ejecucion_min), 0)).join(Ruta).filter(Ruta.fecha == target).scalar()
    )
    cobertura = round((completadas / total_planificados) * 100, 1) if total_planificados else 0
    return {
        "fecha": target.isoformat(),
        "total_pdvs_planificados": total_planificados,
        "total_visitas_completadas": completadas,
        "total_en_progreso": en_progreso,
        "total_reponedores_activos": db.query(Reponedor).filter(Reponedor.activo.is_(True)).count(),
        "km_totales_recorridos": round(float(km_totales or 0), 2),
        "tiempo_efectivo_total": int(tiempo_real or 0),
        "cobertura_porcentaje": cobertura,
    }


@router.get("/rutas-activas")
def rutas_activas(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    target = fecha or date.today()
    rutas = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.fecha == target, Ruta.estado == RutaEstado.EN_EJECUCION)
        .all()
    )
    result = []
    for ruta in rutas:
        last = next((visita for visita in sorted(ruta.visitas, key=lambda item: item.orden_planificado) if visita.estado == VisitaEstado.EN_PROGRESO), None)
        result.append(
            {
                "ruta_id": str(ruta.id),
                "reponedor": ruta.reponedor.nombre,
                "supervisor": ruta.reponedor.supervisor,
                "estado": ruta.estado.value,
                "ultima_coordenada": {
                    "latitud": last.pdv.latitud if last else None,
                    "longitud": last.pdv.longitud if last else None,
                },
            }
        )
    return result


@router.get("/metricas-por-reponedor")
def metricas_por_reponedor(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    target = fecha or date.today()
    reponedores = db.query(Reponedor).filter(Reponedor.activo.is_(True)).order_by(Reponedor.nombre).all()
    rows = []
    for rep in reponedores:
        rutas = db.query(Ruta).filter(Ruta.reponedor_id == rep.id, Ruta.fecha == target).all()
        ruta_ids = [ruta.id for ruta in rutas]
        visitas = db.query(Visita).filter(Visita.ruta_id.in_(ruta_ids)).all() if ruta_ids else []
        total = len(visitas)
        done = sum(1 for visita in visitas if visita.estado == VisitaEstado.COMPLETADA)
        tiempo = sum(visita.tiempo_ejecucion_min or 0 for visita in visitas)
        rows.append(
            {
                "reponedor": rep.nombre,
                "supervisor": rep.supervisor,
                "pdvs_visitados": done,
                "pdvs_planificados": total,
                "tiempo_total": tiempo,
                "distancia_total": round(sum(ruta.distancia_total_km for ruta in rutas), 2),
                "eficiencia": round((done / total) * 100, 1) if total else 0,
            }
        )
    return rows


@router.get("/cobertura-mapa")
def cobertura_mapa(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    target = fecha or date.today()
    visitas = (
        db.query(Visita)
        .options(joinedload(Visita.pdv), joinedload(Visita.ruta).joinedload(Ruta.reponedor))
        .join(Ruta)
        .filter(Ruta.fecha == target)
        .all()
    )
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [visita.pdv.longitud, visita.pdv.latitud]},
            "properties": {
                "visita_id": str(visita.id),
                "codigo": visita.pdv.codigo,
                "mercado": visita.pdv.mercado,
                "tipo_cliente": visita.pdv.tipo_cliente.value,
                "estado": visita.estado.value,
                "reponedor": visita.ruta.reponedor.nombre,
            },
        }
        for visita in visitas
    ]
    lines = []
    for ruta in {visita.ruta for visita in visitas}:
        ordered = sorted(ruta.visitas, key=lambda item: item.orden_planificado)
        waypoints = [(v.pdv.longitud, v.pdv.latitud) for v in ordered]
        road_coords = get_ors_route_geometry(waypoints)
        # Fallback to straight-line coordinates if ORS is unavailable
        line_coords = road_coords if road_coords else [[lng, lat] for lng, lat in waypoints]
        lines.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": line_coords},
                "properties": {
                    "ruta_id": str(ruta.id),
                    "reponedor": ruta.reponedor.nombre,
                    "ors_geometry": road_coords is not None,
                },
            }
        )
    return {"pdvs": {"type": "FeatureCollection", "features": features}, "rutas": {"type": "FeatureCollection", "features": lines}}


@router.get("/desviaciones")
def desviaciones(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    target = fecha or date.today()
    visitas = (
        db.query(Visita)
        .options(joinedload(Visita.pdv), joinedload(Visita.ruta).joinedload(Ruta.reponedor))
        .join(Ruta)
        .filter(Ruta.fecha == target, Visita.estado == VisitaEstado.COMPLETADA, Visita.tiempo_ejecucion_min.isnot(None))
        .all()
    )
    result = []
    for visita in visitas:
        estimated = visita.pdv.tiempo_visita_estimado_min
        if estimated and visita.tiempo_ejecucion_min and visita.tiempo_ejecucion_min > estimated * 1.5:
            result.append(
                {
                    "visita_id": str(visita.id),
                    "fecha": visita.ruta.fecha.isoformat(),
                    "reponedor": visita.ruta.reponedor.nombre,
                    "pdv": visita.pdv.codigo,
                    "mercado": visita.pdv.mercado,
                    "tipo": "TIEMPO",
                    "estimado": estimated,
                    "real": visita.tiempo_ejecucion_min,
                    "factor": round(visita.tiempo_ejecucion_min / estimated, 2),
                }
            )
    return result


@router.get("/por-mercado")
def por_mercado(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    target = fecha or date.today()
    mercados = db.query(PDV.mercado).distinct().order_by(PDV.mercado).all()
    rows = []
    for (mercado,) in mercados:
        total_pdvs = db.query(PDV).filter(PDV.mercado == mercado).count()
        visitas = db.query(Visita).join(PDV).join(Ruta).filter(Ruta.fecha == target, PDV.mercado == mercado).all()
        completadas = sum(1 for visita in visitas if visita.estado == VisitaEstado.COMPLETADA)
        rows.append(
            {
                "mercado": mercado,
                "pdvs_totales": total_pdvs,
                "pdvs_planificados_hoy": len(visitas),
                "visitas_completadas": completadas,
                "cobertura": round((completadas / len(visitas)) * 100, 1) if visitas else 0,
            }
        )
    return rows


@router.get("/reportes-reponedores")
def reportes_reponedores(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    target = fecha or date.today()

    reponedores = db.query(Reponedor).filter(Reponedor.activo.is_(True)).order_by(Reponedor.nombre).all()

    rutas_dia = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.ejecuciones))
        .filter(Ruta.fecha == target)
        .all()
    )
    rutas_por_reponedor: dict = {str(ruta.reponedor_id): ruta for ruta in rutas_dia}

    km_totales = sum(ruta.distancia_total_km or 0 for ruta in rutas_dia)
    tiempo_total_min = sum(ruta.tiempo_total_estimado_min or 0 for ruta in rutas_dia)

    pdvs_planificados = sum(len(ruta.visitas) for ruta in rutas_dia)
    pdvs_completados = sum(
        sum(1 for v in ruta.visitas if v.estado == VisitaEstado.COMPLETADA) for ruta in rutas_dia
    )
    pdvs_en_progreso = sum(
        sum(1 for v in ruta.visitas if v.estado == VisitaEstado.EN_PROGRESO) for ruta in rutas_dia
    )
    pdvs_pendientes = pdvs_planificados - pdvs_completados - pdvs_en_progreso

    lista_reponedores = []
    for rep in reponedores:
        ruta = rutas_por_reponedor.get(str(rep.id))
        visitas = ruta.visitas if ruta else []

        comp = sum(1 for v in visitas if v.estado == VisitaEstado.COMPLETADA)
        en_prog = sum(1 for v in visitas if v.estado == VisitaEstado.EN_PROGRESO)
        pend = sum(1 for v in visitas if v.estado == VisitaEstado.PENDIENTE)

        # Última ubicación: última coordenada_checkin no nula, ordenada por orden_planificado desc
        ultima_ubicacion = None
        visitas_con_checkin = [
            v for v in sorted(visitas, key=lambda x: x.orden_planificado, reverse=True)
            if v.coordenada_checkin is not None
        ]
        if visitas_con_checkin:
            shape = to_shape(visitas_con_checkin[0].coordenada_checkin)
            ultima_ubicacion = {"latitud": shape.y, "longitud": shape.x}

        # Micro tareas
        todas_ejecuciones = [ej for v in visitas for ej in v.ejecuciones]
        micro_completadas = sum(1 for ej in todas_ejecuciones if ej.completada)
        micro_total = len(todas_ejecuciones)

        lista_reponedores.append(
            {
                "id": str(rep.id),
                "nombre": rep.nombre,
                "supervisor": rep.supervisor,
                "vehiculo_tipo": rep.vehiculo_tipo,
                "estado_ruta": ruta.estado.value if ruta else "SIN_RUTA",
                "ruta_id": str(ruta.id) if ruta else None,
                "pdvs_asignados": len(visitas),
                "pdvs_completados": comp,
                "pdvs_en_progreso": en_prog,
                "pdvs_pendientes": pend,
                "km_recorridos": round(float(ruta.distancia_total_km or 0), 2) if ruta else 0.0,
                "km_asignados": round(float(ruta.distancia_total_km or 0), 2) if ruta else 0.0,
                "tiempo_total_estimado_min": ruta.tiempo_total_estimado_min if ruta else None,
                "tiempo_total_real_min": ruta.tiempo_total_real_min if ruta else None,
                "ultima_ubicacion": ultima_ubicacion,
                "micro_tareas_completadas": micro_completadas,
                "micro_tareas_total": micro_total,
            }
        )

    resumen = {
        "total_reponedores": len(reponedores),
        "pdvs_planificados": pdvs_planificados,
        "pdvs_completados": pdvs_completados,
        "pdvs_pendientes": pdvs_pendientes,
        "pdvs_en_progreso": pdvs_en_progreso,
        "km_totales": round(float(km_totales), 2),
        "tiempo_total_min": int(tiempo_total_min),
    }

    return {
        "fecha": target.isoformat(),
        "resumen": resumen,
        "reponedores": lista_reponedores,
    }


@router.get("/reponedor-detalle/{reponedor_id}")
def reponedor_detalle(
    reponedor_id: UUID,
    fecha: date | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    target = fecha or date.today()

    rep = db.query(Reponedor).filter(Reponedor.id == reponedor_id).first()

    ruta = (
        db.query(Ruta)
        .options(
            joinedload(Ruta.visitas)
            .joinedload(Visita.pdv),
            joinedload(Ruta.visitas)
            .joinedload(Visita.ejecuciones)
            .joinedload(EjecucionMicroTarea.micro_tarea),
        )
        .filter(Ruta.reponedor_id == reponedor_id, Ruta.fecha == target)
        .first()
    )

    visitas_ordenadas = sorted(ruta.visitas, key=lambda v: v.orden_planificado) if ruta else []

    visitas_list = []
    for v in visitas_ordenadas:
        checkin_lat = None
        checkin_lng = None
        if v.coordenada_checkin is not None:
            shape = to_shape(v.coordenada_checkin)
            checkin_lat = shape.y
            checkin_lng = shape.x

        ejecuciones_list = [
            {
                "nombre_tarea": ej.micro_tarea.nombre if ej.micro_tarea else None,
                "completada": ej.completada,
                "tiempo_real_min": ej.tiempo_real_min,
                "hora_inicio": ej.hora_inicio.isoformat() if ej.hora_inicio else None,
                "hora_fin": ej.hora_fin.isoformat() if ej.hora_fin else None,
                "foto_evidencia_url": ej.foto_evidencia_url,
            }
            for ej in v.ejecuciones
        ]

        visitas_list.append(
            {
                "id": str(v.id),
                "orden_planificado": v.orden_planificado,
                "estado": v.estado.value,
                "pdv_codigo": v.pdv.codigo,
                "pdv_nombre": v.pdv.nombre,
                "pdv_mercado": v.pdv.mercado,
                "pdv_tipo_cliente": v.pdv.tipo_cliente.value,
                "pdv_latitud": v.pdv.latitud,
                "pdv_longitud": v.pdv.longitud,
                "pdv_tiempo_estimado_min": v.pdv.tiempo_visita_estimado_min,
                "hora_inicio_real": v.hora_inicio_real.isoformat() if v.hora_inicio_real else None,
                "hora_fin_real": v.hora_fin_real.isoformat() if v.hora_fin_real else None,
                "tiempo_ejecucion_min": v.tiempo_ejecucion_min,
                "tiempo_traslado_real_min": v.tiempo_traslado_real_min,
                "tiempo_traslado_planificado_min": v.tiempo_traslado_desde_anterior_min,
                "distancia_planificada_km": v.distancia_desde_anterior_km,
                "traslado_fuente": v.traslado_fuente,
                "checkin_latitud": checkin_lat,
                "checkin_longitud": checkin_lng,
                "ejecuciones": ejecuciones_list,
            }
        )

    # Planned route from the ordered PDV visits. Older route JSON records do not
    # include lat/lng, so the visits table is the reliable source.
    planned_waypoints = [(v.pdv.longitud, v.pdv.latitud) for v in visitas_ordenadas]
    planned_road_coords = get_ors_route_geometry(planned_waypoints) if len(planned_waypoints) >= 2 else None
    ruta_planificada_coords = planned_road_coords or [[lng, lat] for lng, lat in planned_waypoints]

    # Coordenadas reales desde visitas con checkin, ordenadas por orden_planificado
    real_waypoints = [
        (v["checkin_longitud"], v["checkin_latitud"])
        for v in visitas_list
        if v["checkin_longitud"] is not None and v["checkin_latitud"] is not None
    ]
    real_road_coords = get_ors_route_geometry(real_waypoints) if len(real_waypoints) >= 2 else None
    ruta_real_coords = real_road_coords or [[lng, lat] for lng, lat in real_waypoints]

    # Tiempos agregados
    tiempo_en_ruta_min = sum(
        v.tiempo_traslado_real_min or v.tiempo_traslado_desde_anterior_min or 0
        for v in visitas_ordenadas
    )
    tiempo_en_microtareas_min = sum(
        v.tiempo_ejecucion_min or 0
        for v in visitas_ordenadas
        if v.estado == VisitaEstado.COMPLETADA
    )

    todas_ejecuciones = [ej for v in visitas_ordenadas for ej in v.ejecuciones]
    micro_total = len(todas_ejecuciones)
    micro_completadas = sum(1 for ej in todas_ejecuciones if ej.completada)
    fotos_total = sum(1 for ej in todas_ejecuciones if ej.foto_evidencia_url)
    desviaciones_tiempo = sum(
        1
        for v in visitas_ordenadas
        if v.tiempo_ejecucion_min
        and v.pdv.tiempo_visita_estimado_min
        and v.tiempo_ejecucion_min > v.pdv.tiempo_visita_estimado_min * 1.5
    )

    ruta_dict = None
    if ruta:
        ruta_dict = {
            "id": str(ruta.id),
            "estado": ruta.estado.value,
            "distancia_total_km": round(float(ruta.distancia_total_km or 0), 2),
            "tiempo_total_estimado_min": ruta.tiempo_total_estimado_min,
            "tiempo_total_real_min": ruta.tiempo_total_real_min,
            "pdvs_ordenados": ruta.pdvs_ordenados,
        }

    reponedor_dict = None
    if rep:
        reponedor_dict = {
            "id": str(rep.id),
            "nombre": rep.nombre,
            "supervisor": rep.supervisor,
            "email": rep.email,
            "vehiculo_tipo": rep.vehiculo_tipo,
        }

    return {
        "reponedor": reponedor_dict,
        "fecha": target.isoformat(),
        "ruta": ruta_dict,
        "visitas": visitas_list,
        "ruta_planificada_coords": ruta_planificada_coords,
        "ruta_real_coords": ruta_real_coords,
        "ruta_planificada_ors": planned_road_coords is not None,
        "ruta_real_ors": real_road_coords is not None,
        "tiempo_en_ruta_min": int(tiempo_en_ruta_min),
        "tiempo_en_microtareas_min": int(tiempo_en_microtareas_min),
        "micro_tareas_total": micro_total,
        "micro_tareas_completadas": micro_completadas,
        "fotos_total": fotos_total,
        "desviaciones_tiempo": desviaciones_tiempo,
    }
