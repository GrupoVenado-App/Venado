from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import EjecucionMicroTarea, HistorialTiempo, MicroTarea, PDV, Ruta, Visita


def recalcular_historial(db: Session) -> dict:
    desde = date.today() - timedelta(days=30)
    rows = (
        db.query(
            EjecucionMicroTarea.micro_tarea_id,
            PDV.tipo_cliente,
            func.avg(EjecucionMicroTarea.tiempo_real_min).label("promedio"),
            func.count(EjecucionMicroTarea.id).label("muestras"),
        )
        .join(Visita, Visita.id == EjecucionMicroTarea.visita_id)
        .join(PDV, PDV.id == Visita.pdv_id)
        .filter(EjecucionMicroTarea.completada.is_(True))
        .filter(EjecucionMicroTarea.tiempo_real_min.isnot(None))
        .filter(func.date(Visita.hora_fin_real) >= desde)
        .group_by(EjecucionMicroTarea.micro_tarea_id, PDV.tipo_cliente)
        .all()
    )

    today = date.today()
    semana = int(today.strftime("%V"))
    created = 0
    updated = 0
    for row in rows:
        existing = db.query(HistorialTiempo).filter(
            HistorialTiempo.micro_tarea_id == row.micro_tarea_id,
            HistorialTiempo.pdv_tipo_cliente == row.tipo_cliente,
            HistorialTiempo.fecha_calculo == today
        ).one_or_none()

        if existing:
            existing.tiempo_promedio_real_min = round(float(row.promedio), 2)
            existing.cantidad_muestras = int(row.muestras)
            existing.semana_anio = semana
            updated += 1
        else:
            db.add(
                HistorialTiempo(
                    micro_tarea_id=row.micro_tarea_id,
                    pdv_tipo_cliente=row.tipo_cliente,
                    tiempo_promedio_real_min=round(float(row.promedio), 2),
                    cantidad_muestras=int(row.muestras),
                    fecha_calculo=today,
                    semana_anio=semana,
                )
            )
            created += 1

    suggestions = []
    planned = db.query(Ruta).filter(Ruta.fecha >= today).all()
    if planned:
        totals = [ruta.tiempo_total_estimado_min for ruta in planned if ruta.tiempo_total_estimado_min]
        if totals:
            avg = sum(totals) / len(totals)
            if avg and (max(totals) - min(totals)) / avg > 0.20:
                suggestions.append("Redistribuir carga: diferencia estimada mayor al 20% entre rutas.")

    if not rows and not db.query(MicroTarea).count():
        suggestions.append("No existen micro-tareas para recalcular.")

    db.commit()
    return {"historial_creado": created, "ventana_dias": 30, "sugerencias": suggestions}
