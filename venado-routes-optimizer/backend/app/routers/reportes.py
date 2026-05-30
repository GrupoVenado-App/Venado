import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import EjecucionMicroTarea, Ruta, Visita


router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/exportar-bi")
def exportar_bi(
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> StreamingResponse:
    visitas = (
        db.query(Visita)
        .options(
            joinedload(Visita.pdv),
            joinedload(Visita.ruta).joinedload(Ruta.reponedor),
            joinedload(Visita.ejecuciones).joinedload(EjecucionMicroTarea.micro_tarea),
        )
        .join(Ruta)
        .order_by(Ruta.fecha.desc(), Visita.orden_planificado)
        .all()
    )
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(
        [
            # Identificación
            "fecha",
            "reponedor",
            "supervisor",
            "mercado",
            "pdv",
            "tipo_cliente",
            "orden_visita",
            "estado_visita",
            # Tiempos de traslado
            "hora_inicio_traslado",
            "hora_fin_traslado",
            "tiempo_traslado_real_min",
            "ors_tiempo_traslado_desde_anterior_min",
            "distancia_desde_anterior_km",
            "ors_distancia_desde_anterior_km",
            "fuente_calculo_traslado",
            # Tiempos de visita
            "hora_inicio_visita",
            "hora_fin_visita",
            "tiempo_ejecucion_real_min",
            "tiempo_visita_estimado_min",
            # Micro-tareas
            "micro_tareas_completadas",
            "micro_tareas_detalle",
            "tiempos_reales_micro_tareas",
            # Geografía
            "latitud",
            "longitud",
        ]
    )
    for visita in visitas:
        tareas_completadas = sum(1 for e in visita.ejecuciones if e.completada)
        tareas_detalle = "; ".join(
            f"{e.micro_tarea.nombre}({e.tiempo_real_min or '?'}min)" for e in visita.ejecuciones
        )
        tiempos_reales = "; ".join(str(e.tiempo_real_min or "") for e in visita.ejecuciones)

        writer.writerow(
            [
                # Identificación
                visita.ruta.fecha.isoformat(),
                visita.ruta.reponedor.nombre,
                visita.ruta.reponedor.supervisor,
                visita.pdv.mercado,
                visita.pdv.codigo,
                visita.pdv.tipo_cliente.value,
                visita.orden_planificado,
                visita.estado.value,
                # Tiempos de traslado
                visita.hora_inicio_traslado.isoformat() if visita.hora_inicio_traslado else "",
                visita.hora_fin_traslado.isoformat() if visita.hora_fin_traslado else "",
                visita.tiempo_traslado_real_min if visita.tiempo_traslado_real_min is not None else "",
                visita.ors_tiempo_traslado_desde_anterior_min if visita.ors_tiempo_traslado_desde_anterior_min is not None else "",
                round(visita.distancia_desde_anterior_km, 3) if visita.distancia_desde_anterior_km is not None else "",
                round(visita.ors_distancia_desde_anterior_km, 3) if visita.ors_distancia_desde_anterior_km is not None else "",
                visita.traslado_fuente,
                # Tiempos de visita
                visita.hora_inicio_real.isoformat() if visita.hora_inicio_real else "",
                visita.hora_fin_real.isoformat() if visita.hora_fin_real else "",
                visita.tiempo_ejecucion_min if visita.tiempo_ejecucion_min is not None else "",
                visita.pdv.tiempo_visita_estimado_min,
                # Micro-tareas
                tareas_completadas,
                tareas_detalle,
                tiempos_reales,
                # Geografía
                visita.pdv.latitud,
                visita.pdv.longitud,
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="venado_bi_export.csv"'},
    )
