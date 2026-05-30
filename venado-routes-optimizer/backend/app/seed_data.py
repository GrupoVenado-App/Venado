import argparse
import csv
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import delete, func
from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import SessionLocal, init_db
from app.models import (
    EjecucionMicroTarea,
    HistorialTiempo,
    MicroTarea,
    PDV,
    Reponedor,
    Ruta,
    Supervisor,
    TipoCliente,
    Visita,
)


DATA_PATH = Path(__file__).resolve().parent / "data" / "pdvs_la_paz.csv"

MICRO_TAREAS = [
    # PARETO (~90 min total)
    ("Faldones", TipoCliente.PARETO, "KRIS", 30),
    ("Revision de Inventario", TipoCliente.PARETO, "GENERAL", 20),
    ("Negociacion de Espacios", TipoCliente.PARETO, "GENERAL", 25),
    ("Fotografias y Evidencia", TipoCliente.PARETO, "GENERAL", 15),
    # MAYORISTA (~65 min total)
    ("Toldos Enrrolables", TipoCliente.MAYORISTA, "BRISTAR", 28),
    ("Verificacion de Stock", TipoCliente.MAYORISTA, "GENERAL", 17),
    ("Toma de Pedidos", TipoCliente.MAYORISTA, "GENERAL", 20),
    # MINORISTA (~38 min total)
    ("Gancheras de Pared", TipoCliente.MINORISTA, "DE LA GRANJA", 23),
    ("Acomodo de Vitrina", TipoCliente.MINORISTA, "GENERAL", 15),
    # DETALLISTA (~37 min total)
    ("Exhibidor a Medida", TipoCliente.DETALLISTA, "MULTIMARCA", 15),
    ("Marco Destacador", TipoCliente.DETALLISTA, "PULPIN", 10),
    ("Exhibidor Colgante Caldos", TipoCliente.DETALLISTA, "KRIOLLA", 12),
]

EQUIPO = {
    "SUPERVISOR 1": ["REPONEDOR 1", "REPONEDOR 2"],
    "SUPERVISOR 2": [
        "REPONEDOR 3",
        "REPONEDOR 4",
        "REPONEDOR 5",
        "REPONEDOR 6",
        "REPONEDOR 7",
        "REPONEDOR 8",
        "REPONEDOR 8 APOYO",
        "REPONEDOR 9",
        "REPONEDOR 10",
        "REPONEDOR 11",
        "REPONEDOR 12",
        "REPONEDOR 13",
    ],
    "SUPERVISOR 3": [
        "REPONEDOR 14",
        "REPONEDOR 15",
        "REPONEDOR 16",
        "REPONEDOR 17",
        "REPONEDOR 18",
        "REPONEDOR 19",
        "REPONEDOR 20",
        "REPONEDOR 21",
        "REPONEDOR 22",
        "REPONEDOR 23",
    ],
}


def email_for(nombre: str) -> str:
    slug = nombre.lower().replace(" ", ".")
    return f"{slug}@venado.local"


def point_from_lng_lat(longitud: float, latitud: float):
    return from_shape(Point(longitud, latitud), srid=4326)


def seed_micro_tareas(db: Session) -> list[MicroTarea]:
    tareas: list[MicroTarea] = []
    for nombre, tipo, marca, minutos in MICRO_TAREAS:
        tarea = (
            db.query(MicroTarea)
            .filter(MicroTarea.nombre == nombre, MicroTarea.tipo_cliente == tipo, MicroTarea.marca == marca)
            .one_or_none()
        )
        if not tarea:
            tarea = MicroTarea(
                nombre=nombre,
                tipo_cliente=tipo,
                marca=marca,
                tiempo_estimado_minutos=minutos,
                descripcion=f"Tarea base {marca or ''} para clientes {tipo.value}",
            )
            db.add(tarea)
        tareas.append(tarea)
    db.flush()
    return tareas


def seed_equipo(db: Session) -> None:
    supervisor_hash = get_password_hash("supervisor123")
    reponedor_hash = get_password_hash("reponedor123")

    for supervisor_nombre, reponedores in EQUIPO.items():
        supervisor = db.query(Supervisor).filter(Supervisor.nombre == supervisor_nombre).one_or_none()
        if not supervisor:
            db.add(
                Supervisor(
                    nombre=supervisor_nombre,
                    email=email_for(supervisor_nombre),
                    hashed_password=supervisor_hash,
                    activo=True,
                )
            )

        for reponedor_nombre in reponedores:
            reponedor = db.query(Reponedor).filter(Reponedor.nombre == reponedor_nombre).one_or_none()
            if not reponedor:
                db.add(
                    Reponedor(
                        nombre=reponedor_nombre,
                        email=email_for(reponedor_nombre),
                        hashed_password=reponedor_hash,
                        supervisor=supervisor_nombre,
                        telefono="",
                        activo=True,
                        vehiculo_tipo="A pie / transporte urbano",
                    )
                )
    db.flush()


def seed_pdvs(db: Session) -> int:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"No se encontro el CSV de PDVs: {DATA_PATH}")

    created = 0
    with DATA_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            codigo = row["codigo"].strip().upper()
            existing = db.query(PDV).filter(PDV.codigo == codigo).one_or_none()
            if existing:
                continue
            latitud = float(row["latitud"])
            longitud = float(row["longitud"])
            dias_atencion = {
                "lunes": int(row["lunes"]),
                "martes": int(row["martes"]),
                "miercoles": int(row["miercoles"]),
                "jueves": int(row["jueves"]),
                "viernes": int(row["viernes"]),
                "sabado": int(row["sabado"]),
            }
            pdv = PDV(
                codigo=codigo,
                codigo_interno=row["codigo_interno"].strip(),
                nombre=row["nombre"].strip().upper(),
                mercado=row["mercado"].strip().upper(),
                direccion=None,
                tipo_cliente=TipoCliente(row["tipo_cliente"].strip().upper()),
                ubicacion=point_from_lng_lat(longitud, latitud),
                latitud=latitud,
                longitud=longitud,
                supervisor=row["supervisor"].strip().upper(),
                reponedor_asignado=row["reponedor_asignado"].strip().upper(),
                tiempo_visita_estimado_min=int(row["tiempo_visita_estimado_min"]),
                dias_atencion=dias_atencion,
                frecuencia_semanal=int(row["frecuencia_semanal"]),
                frecuencia_mensual=int(row["frecuencia_mensual"]),
                activo=True,
            )
            db.add(pdv)
            created += 1
    db.flush()
    return created


def seed_historial_base(db: Session) -> int:
    if db.query(HistorialTiempo).count() > 0:
        return 0

    today = date.today()
    created = 0
    tareas = db.query(MicroTarea).all()
    for days_ago in (3, 2, 1):
        fecha = today - timedelta(days=days_ago)
        semana = int(fecha.strftime("%V"))
        for tarea in tareas:
            # Deterministic simulated samples for the demo feedback loop.
            adjustment = (days_ago - 2) * 0.08
            db.add(
                HistorialTiempo(
                    micro_tarea_id=tarea.id,
                    pdv_tipo_cliente=tarea.tipo_cliente,
                    tiempo_promedio_real_min=round(tarea.tiempo_estimado_minutos * (1 + adjustment), 2),
                    cantidad_muestras=6,
                    fecha_calculo=fecha,
                    semana_anio=semana,
                )
            )
            created += 1
    db.flush()
    return created


def seed_all(db: Session, force: bool = False) -> dict[str, int]:
    if force:
        for model in [HistorialTiempo, EjecucionMicroTarea, Visita, Ruta, PDV, MicroTarea, Reponedor, Supervisor]:
            db.execute(delete(model))
        db.commit()

    seed_micro_tareas(db)
    seed_equipo(db)
    pdvs_created = seed_pdvs(db)
    historial_created = seed_historial_base(db)
    db.commit()
    return {
        "pdvs_created": pdvs_created,
        "micro_tareas": db.query(MicroTarea).count(),
        "supervisores": db.query(Supervisor).count(),
        "reponedores": db.query(Reponedor).count(),
        "historial_created": historial_created,
        "seeded_at": int(datetime.now(UTC).timestamp()),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Recrear datos semilla")
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        result = seed_all(db, force=args.force)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
