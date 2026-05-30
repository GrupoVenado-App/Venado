from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.services.feedback_loop import recalcular_historial


router = APIRouter(prefix="/feedback-loop", tags=["feedback-loop"])


@router.post("/recalcular")
def recalcular(
    db: Session = Depends(get_db),
    _user=Depends(require_role("supervisor")),
) -> dict:
    return recalcular_historial(db)
