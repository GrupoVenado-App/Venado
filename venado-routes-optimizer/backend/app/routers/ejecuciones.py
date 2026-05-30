import base64
import math
import os
import uuid
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.config import settings
from app.database import get_db
from app.models import EjecucionMicroTarea
from app.schemas import FotoIn


router = APIRouter(prefix="/ejecuciones-micro-tarea", tags=["ejecuciones"])


def get_ejecucion_or_404(db: Session, ejecucion_id: UUID) -> EjecucionMicroTarea:
    ejecucion = (
        db.query(EjecucionMicroTarea)
        .options(joinedload(EjecucionMicroTarea.micro_tarea))
        .filter(EjecucionMicroTarea.id == ejecucion_id)
        .one_or_none()
    )
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecucion no encontrada")
    return ejecucion


def save_photo(foto_base64: str | None) -> str | None:
    if not foto_base64:
        return None
    data = foto_base64.split(",", 1)[1] if "," in foto_base64 else foto_base64
    raw = base64.b64decode(data)
    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    path = os.path.join(settings.upload_dir, filename)
    with open(path, "wb") as handle:
        handle.write(raw)
    return f"/uploads/{filename}"


@router.post("/{ejecucion_id}/iniciar")
def iniciar_ejecucion(
    ejecucion_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    ejecucion = get_ejecucion_or_404(db, ejecucion_id)
    now = datetime.now(UTC)
    ejecucion.hora_inicio = now
    ejecucion.completada = False
    db.commit()
    return {"ok": True, "hora_inicio": now.isoformat()}


@router.post("/{ejecucion_id}/finalizar")
def finalizar_ejecucion(
    ejecucion_id: UUID,
    payload: FotoIn | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    ejecucion = get_ejecucion_or_404(db, ejecucion_id)
    if not ejecucion.hora_inicio:
        raise HTTPException(status_code=400, detail="La micro-tarea aun no fue iniciada")
    now = datetime.now(UTC)
    ejecucion.hora_fin = now
    ejecucion.tiempo_real_min = max(1, math.ceil((now - ejecucion.hora_inicio).total_seconds() / 60))
    ejecucion.completada = True
    if payload and payload.foto_base64:
        ejecucion.foto_evidencia_url = save_photo(payload.foto_base64)
    db.commit()
    return {
        "ok": True,
        "hora_fin": now.isoformat(),
        "tiempo_real_min": ejecucion.tiempo_real_min,
        "foto_evidencia_url": ejecucion.foto_evidencia_url,
    }


@router.post("/{ejecucion_id}/completar")
def completar_ejecucion(
    ejecucion_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("reponedor")),
) -> dict:
    ejecucion = get_ejecucion_or_404(db, ejecucion_id)
    now = datetime.now(UTC)
    ejecucion.completada = not ejecucion.completada
    if ejecucion.completada:
        ejecucion.hora_fin = ejecucion.hora_fin or now
        if not ejecucion.tiempo_real_min:
            ejecucion.tiempo_real_min = ejecucion.micro_tarea.tiempo_estimado_minutos
    db.commit()
    return {"ok": True, "completada": ejecucion.completada}
