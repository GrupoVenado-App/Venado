from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import Reponedor, Supervisor
from app.schemas import ReponedorOut, SupervisorOut


router = APIRouter(tags=["equipo"])


@router.get("/reponedores", response_model=list[ReponedorOut])
def list_reponedores(
    supervisor: str | None = None,
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[Reponedor]:
    query = db.query(Reponedor).order_by(Reponedor.nombre)
    if supervisor:
        query = query.filter(Reponedor.supervisor == supervisor.upper())
    return query.all()


@router.get("/supervisores", response_model=list[SupervisorOut])
def list_supervisores(
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor", "reponedor")),
) -> list[Supervisor]:
    return db.query(Supervisor).order_by(Supervisor.nombre).all()
