import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import SessionLocal, init_db
from app.routers import auth, dashboard, ejecuciones, equipo, feedback, micro_tareas, pdvs, reportes, rutas, visitas
from app.seed_data import seed_all


app = FastAPI(title="Venado Routes Optimizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.on_event("startup")
def startup() -> None:
    init_db()
    if settings.seed_on_start:
        db = SessionLocal()
        try:
            seed_all(db)
        finally:
            db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(equipo.router)
app.include_router(pdvs.router)
app.include_router(micro_tareas.router)
app.include_router(rutas.router)
app.include_router(visitas.router)
app.include_router(ejecuciones.router)
app.include_router(dashboard.router)
app.include_router(reportes.router)
app.include_router(feedback.router)


frontend_dist = os.getenv("FRONTEND_DIST_DIR")
if frontend_dist and Path(frontend_dist).exists():
    dist_path = Path(frontend_dist)
    assets_path = dist_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        requested = dist_path / full_path
        if full_path and requested.is_file():
            return FileResponse(requested)
        return FileResponse(dist_path / "index.html")
