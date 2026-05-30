from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import MicroTarea, PDV, TipoCliente
from app.schemas import MicroTareaOut


router = APIRouter(prefix="/micro-tareas", tags=["micro-tareas"])


@router.get("", response_model=list[MicroTareaOut])
def list_micro_tareas(
    tipo: TipoCliente | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[MicroTarea]:
    query = db.query(MicroTarea)
    if tipo:
        query = query.filter(MicroTarea.tipo_cliente == tipo)
    return query.order_by(MicroTarea.tipo_cliente, MicroTarea.nombre).all()


@router.get("/por-pdv/{pdv_id}", response_model=list[MicroTareaOut])
def micro_tareas_por_pdv(
    pdv_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[MicroTarea]:
    pdv = db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV no encontrado")
    return db.query(MicroTarea).filter(MicroTarea.tipo_cliente == pdv.tipo_cliente).all()
