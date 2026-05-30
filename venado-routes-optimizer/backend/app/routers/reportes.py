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
            "fecha",
            "reponedor",
            "supervisor",
            "mercado",
            "pdv",
            "tipo_cliente",
            "micro_tareas",
            "tiempos_reales",
            "distancia_desde_anterior_km",
            "latitud",
            "longitud",
            "estado",
        ]
    )
    for visita in visitas:
        tareas = "; ".join(item.micro_tarea.nombre for item in visita.ejecuciones)
        tiempos = "; ".join(str(item.tiempo_real_min or "") for item in visita.ejecuciones)
        writer.writerow(
            [
                visita.ruta.fecha.isoformat(),
                visita.ruta.reponedor.nombre,
                visita.ruta.reponedor.supervisor,
                visita.pdv.mercado,
                visita.pdv.codigo,
                visita.pdv.tipo_cliente.value,
                tareas,
                tiempos,
                visita.distancia_desde_anterior_km,
                visita.pdv.latitud,
                visita.pdv.longitud,
                visita.estado.value,
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="venado_bi_export.csv"'},
    )
