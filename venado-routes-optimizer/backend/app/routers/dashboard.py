from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import PDV, Reponedor, Ruta, RutaEstado, Visita, VisitaEstado


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/resumen-hoy")
def resumen_hoy(
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    today = date.today()
    total_planificados = db.query(Visita).join(Ruta).filter(Ruta.fecha == today).count()
    completadas = db.query(Visita).join(Ruta).filter(Ruta.fecha == today, Visita.estado == VisitaEstado.COMPLETADA).count()
    en_progreso = db.query(Visita).join(Ruta).filter(Ruta.fecha == today, Visita.estado == VisitaEstado.EN_PROGRESO).count()
    km_totales = db.query(func.coalesce(func.sum(Ruta.distancia_total_km), 0)).filter(Ruta.fecha == today).scalar()
    tiempo_real = (
        db.query(func.coalesce(func.sum(Visita.tiempo_ejecucion_min), 0)).join(Ruta).filter(Ruta.fecha == today).scalar()
    )
    cobertura = round((completadas / total_planificados) * 100, 1) if total_planificados else 0
    return {
        "fecha": today.isoformat(),
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
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    today = date.today()
    rutas = (
        db.query(Ruta)
        .options(joinedload(Ruta.reponedor), joinedload(Ruta.visitas).joinedload(Visita.pdv))
        .filter(Ruta.fecha == today, Ruta.estado == RutaEstado.EN_EJECUCION)
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
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    today = date.today()
    reponedores = db.query(Reponedor).filter(Reponedor.activo.is_(True)).order_by(Reponedor.nombre).all()
    rows = []
    for rep in reponedores:
        rutas = db.query(Ruta).filter(Ruta.reponedor_id == rep.id, Ruta.fecha == today).all()
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
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    today = date.today()
    visitas = (
        db.query(Visita)
        .options(joinedload(Visita.pdv), joinedload(Visita.ruta).joinedload(Ruta.reponedor))
        .join(Ruta)
        .filter(Ruta.fecha == today)
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
        lines.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[v.pdv.longitud, v.pdv.latitud] for v in ordered]},
                "properties": {"ruta_id": str(ruta.id), "reponedor": ruta.reponedor.nombre},
            }
        )
    return {"pdvs": {"type": "FeatureCollection", "features": features}, "rutas": {"type": "FeatureCollection", "features": lines}}


@router.get("/desviaciones")
def desviaciones(
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    visitas = (
        db.query(Visita)
        .options(joinedload(Visita.pdv), joinedload(Visita.ruta).joinedload(Ruta.reponedor))
        .filter(Visita.estado == VisitaEstado.COMPLETADA, Visita.tiempo_ejecucion_min.isnot(None))
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
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> list[dict]:
    today = date.today()
    mercados = db.query(PDV.mercado).distinct().order_by(PDV.mercado).all()
    rows = []
    for (mercado,) in mercados:
        total_pdvs = db.query(PDV).filter(PDV.mercado == mercado).count()
        visitas = db.query(Visita).join(PDV).join(Ruta).filter(Ruta.fecha == today, PDV.mercado == mercado).all()
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
