from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import PDV, TipoCliente
from app.schemas import PDVOut


router = APIRouter(prefix="/pdvs", tags=["pdvs"])


@router.get("", response_model=list[PDVOut])
def list_pdvs(
    tipo: TipoCliente | None = None,
    mercado: str | None = None,
    supervisor: str | None = None,
    reponedor: str | None = None,
    activo: bool | None = True,
    skip: int = 0,
    limit: int = 600,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[PDV]:
    query = db.query(PDV)
    if tipo:
        query = query.filter(PDV.tipo_cliente == tipo)
    if mercado:
        query = query.filter(PDV.mercado == mercado.strip().upper())
    if supervisor:
        query = query.filter(PDV.supervisor == supervisor.strip().upper())
    if reponedor:
        query = query.filter(PDV.reponedor_asignado == reponedor.strip().upper())
    if activo is not None:
        query = query.filter(PDV.activo.is_(activo))
    return query.order_by(PDV.codigo).offset(skip).limit(min(limit, 1000)).all()


@router.get("/mapa")
def pdvs_mapa(
    tipo: TipoCliente | None = None,
    mercado: str | None = None,
    supervisor: str | None = None,
    reponedor: str | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> dict:
    pdvs = list_pdvs(tipo, mercado, supervisor, reponedor, True, 0, 1000, db, _user)
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [pdv.longitud, pdv.latitud]},
                "properties": {
                    "id": str(pdv.id),
                    "codigo": pdv.codigo,
                    "nombre": pdv.nombre,
                    "mercado": pdv.mercado,
                    "tipo_cliente": pdv.tipo_cliente.value,
                    "supervisor": pdv.supervisor,
                    "reponedor": pdv.reponedor_asignado,
                    "tiempo_visita_estimado_min": pdv.tiempo_visita_estimado_min,
                },
            }
            for pdv in pdvs
        ],
    }


@router.get("/{pdv_id}", response_model=PDVOut)
def get_pdv(
    pdv_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> PDV:
    pdv = db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV no encontrado")
    return pdv
