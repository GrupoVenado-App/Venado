import time
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_lightweight_migrations() -> None:
    """Small demo migrations for fields added after the first Docker volume was created."""
    statements = [
        "ALTER TYPE visita_estado ADD VALUE IF NOT EXISTS 'EN_TRASLADO'",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS hora_inicio_traslado TIMESTAMPTZ",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS hora_fin_traslado TIMESTAMPTZ",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS tiempo_traslado_real_min INTEGER",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS coordenada_inicio_traslado GEOGRAPHY(POINT, 4326)",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS coordenada_fin_traslado GEOGRAPHY(POINT, 4326)",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS ors_distancia_desde_anterior_km DOUBLE PRECISION",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS ors_tiempo_traslado_desde_anterior_min INTEGER",
        "ALTER TABLE visita ADD COLUMN IF NOT EXISTS traslado_fuente VARCHAR(30) DEFAULT 'LOCAL' NOT NULL",
        "UPDATE visita SET traslado_fuente = 'LOCAL' WHERE traslado_fuente IS NULL",
    ]
    for statement in statements:
        with engine.begin() as conn:
            conn.execute(text(statement))


def create_bi_views() -> None:
    """Power BI friendly SQL views over the normalized operational tables."""
    day_name = """
        CASE EXTRACT(ISODOW FROM r.fecha)::int
            WHEN 1 THEN 'lunes'
            WHEN 2 THEN 'martes'
            WHEN 3 THEN 'miercoles'
            WHEN 4 THEN 'jueves'
            WHEN 5 THEN 'viernes'
            WHEN 6 THEN 'sabado'
            ELSE 'domingo'
        END
    """
    statements = [
        f"""
        CREATE OR REPLACE VIEW bi_visitas AS
        SELECT
            r.fecha,
            EXTRACT(YEAR FROM r.fecha)::int AS anio,
            EXTRACT(MONTH FROM r.fecha)::int AS mes,
            EXTRACT(WEEK FROM r.fecha)::int AS semana_iso,
            {day_name} AS dia_semana,
            r.id::text AS ruta_id,
            v.id::text AS visita_id,
            v.orden_planificado AS orden_visita,
            v.estado::text AS estado_visita,
            rep.supervisor,
            rep.nombre AS reponedor,
            p.id::text AS pdv_id,
            p.codigo AS pdv_codigo,
            p.nombre AS pdv_nombre,
            p.mercado,
            p.tipo_cliente::text AS tipo_cliente,
            p.latitud AS latitud_pdv,
            p.longitud AS longitud_pdv,
            ST_Y(v.coordenada_checkin::geometry) AS checkin_latitud,
            ST_X(v.coordenada_checkin::geometry) AS checkin_longitud,
            ST_Y(v.coordenada_checkout::geometry) AS checkout_latitud,
            ST_X(v.coordenada_checkout::geometry) AS checkout_longitud,
            v.distancia_desde_anterior_km AS distancia_planificada_km,
            v.ors_distancia_desde_anterior_km AS distancia_ors_km,
            v.tiempo_traslado_desde_anterior_min AS tiempo_traslado_planificado_min,
            v.ors_tiempo_traslado_desde_anterior_min AS tiempo_traslado_ors_min,
            v.tiempo_traslado_real_min,
            v.traslado_fuente AS fuente_calculo_traslado,
            v.hora_inicio_traslado AT TIME ZONE 'America/La_Paz' AS hora_inicio_traslado,
            v.hora_fin_traslado AT TIME ZONE 'America/La_Paz' AS hora_fin_traslado,
            v.hora_inicio_real AT TIME ZONE 'America/La_Paz' AS hora_inicio_visita,
            v.hora_fin_real AT TIME ZONE 'America/La_Paz' AS hora_fin_visita,
            p.tiempo_visita_estimado_min AS tiempo_pdv_estimado_min,
            v.tiempo_ejecucion_min AS tiempo_pdv_real_min,
            (v.tiempo_ejecucion_min - p.tiempo_visita_estimado_min) AS desviacion_pdv_min,
            CASE
                WHEN p.tiempo_visita_estimado_min > 0 AND v.tiempo_ejecucion_min IS NOT NULL
                THEN ROUND(((v.tiempo_ejecucion_min - p.tiempo_visita_estimado_min)::numeric / p.tiempo_visita_estimado_min) * 100, 2)
                ELSE NULL
            END AS desviacion_pdv_pct,
            COALESCE(v.tiempo_ejecucion_min > p.tiempo_visita_estimado_min * 1.5, false) AS desviacion_pdv_alerta,
            COALESCE(mt.micro_tareas_total, 0) AS micro_tareas_total,
            COALESCE(mt.micro_tareas_completadas, 0) AS micro_tareas_completadas,
            COALESCE(mt.micro_tareas_total, 0) - COALESCE(mt.micro_tareas_completadas, 0) AS micro_tareas_pendientes,
            COALESCE(mt.evidencias_fotos_total, 0) AS evidencias_fotos_total,
            mt.evidencias_fotos_urls
        FROM visita v
        JOIN ruta r ON r.id = v.ruta_id
        JOIN reponedor rep ON rep.id = r.reponedor_id
        JOIN pdv p ON p.id = v.pdv_id
        LEFT JOIN (
            SELECT
                visita_id,
                COUNT(*) AS micro_tareas_total,
                COUNT(*) FILTER (WHERE completada) AS micro_tareas_completadas,
                COUNT(*) FILTER (WHERE foto_evidencia_url IS NOT NULL) AS evidencias_fotos_total,
                STRING_AGG(foto_evidencia_url, ' | ') FILTER (WHERE foto_evidencia_url IS NOT NULL) AS evidencias_fotos_urls
            FROM ejecucion_micro_tarea
            GROUP BY visita_id
        ) mt ON mt.visita_id = v.id
        """,
        f"""
        CREATE OR REPLACE VIEW bi_micro_tareas AS
        SELECT
            r.fecha,
            EXTRACT(YEAR FROM r.fecha)::int AS anio,
            EXTRACT(MONTH FROM r.fecha)::int AS mes,
            EXTRACT(WEEK FROM r.fecha)::int AS semana_iso,
            {day_name} AS dia_semana,
            r.id::text AS ruta_id,
            v.id::text AS visita_id,
            v.orden_planificado AS orden_visita,
            v.estado::text AS estado_visita,
            rep.supervisor,
            rep.nombre AS reponedor,
            p.codigo AS pdv_codigo,
            p.nombre AS pdv_nombre,
            p.mercado,
            p.tipo_cliente::text AS tipo_cliente,
            e.id::text AS ejecucion_micro_tarea_id,
            mt.id::text AS micro_tarea_id,
            mt.nombre AS micro_tarea,
            mt.marca,
            e.completada,
            mt.tiempo_estimado_minutos AS tiempo_estimado_micro_tarea_min,
            e.tiempo_real_min AS tiempo_real_micro_tarea_min,
            (e.tiempo_real_min - mt.tiempo_estimado_minutos) AS desviacion_micro_tarea_min,
            e.hora_inicio AT TIME ZONE 'America/La_Paz' AS hora_inicio_micro_tarea,
            e.hora_fin AT TIME ZONE 'America/La_Paz' AS hora_fin_micro_tarea,
            e.foto_evidencia_url
        FROM ejecucion_micro_tarea e
        JOIN micro_tarea mt ON mt.id = e.micro_tarea_id
        JOIN visita v ON v.id = e.visita_id
        JOIN ruta r ON r.id = v.ruta_id
        JOIN reponedor rep ON rep.id = r.reponedor_id
        JOIN pdv p ON p.id = v.pdv_id
        """,
        f"""
        CREATE OR REPLACE VIEW bi_rutas AS
        SELECT
            r.fecha,
            EXTRACT(YEAR FROM r.fecha)::int AS anio,
            EXTRACT(MONTH FROM r.fecha)::int AS mes,
            EXTRACT(WEEK FROM r.fecha)::int AS semana_iso,
            {day_name} AS dia_semana,
            r.id::text AS ruta_id,
            r.estado::text AS estado_ruta,
            rep.supervisor,
            rep.nombre AS reponedor,
            COUNT(v.id) AS pdvs_planificados,
            COUNT(v.id) FILTER (WHERE v.estado = 'COMPLETADA') AS pdvs_completados,
            COUNT(v.id) FILTER (WHERE v.estado = 'EN_PROGRESO') AS pdvs_en_progreso,
            COUNT(v.id) FILTER (WHERE v.estado = 'EN_TRASLADO') AS pdvs_en_traslado,
            COUNT(v.id) FILTER (WHERE v.estado = 'PENDIENTE') AS pdvs_pendientes,
            CASE
                WHEN COUNT(v.id) > 0
                THEN ROUND((COUNT(v.id) FILTER (WHERE v.estado = 'COMPLETADA')::numeric / COUNT(v.id)) * 100, 2)
                ELSE 0
            END AS cobertura_pct,
            r.distancia_total_km AS distancia_total_planificada_km,
            r.tiempo_total_estimado_min AS tiempo_total_planificado_min,
            r.tiempo_total_real_min,
            SUM(COALESCE(v.tiempo_traslado_real_min, 0)) AS tiempo_traslado_real_min,
            SUM(COALESCE(v.tiempo_ejecucion_min, 0)) AS tiempo_pdv_real_min,
            COALESCE(mt.micro_tareas_total, 0) AS micro_tareas_total,
            COALESCE(mt.micro_tareas_completadas, 0) AS micro_tareas_completadas,
            COALESCE(mt.evidencias_fotos_total, 0) AS evidencias_fotos_total
        FROM ruta r
        JOIN reponedor rep ON rep.id = r.reponedor_id
        LEFT JOIN visita v ON v.ruta_id = r.id
        LEFT JOIN (
            SELECT
                v2.ruta_id,
                COUNT(e.id) AS micro_tareas_total,
                COUNT(e.id) FILTER (WHERE e.completada) AS micro_tareas_completadas,
                COUNT(e.id) FILTER (WHERE e.foto_evidencia_url IS NOT NULL) AS evidencias_fotos_total
            FROM visita v2
            LEFT JOIN ejecucion_micro_tarea e ON e.visita_id = v2.id
            GROUP BY v2.ruta_id
        ) mt ON mt.ruta_id = r.id
        GROUP BY
            r.id, rep.supervisor, rep.nombre, mt.micro_tareas_total,
            mt.micro_tareas_completadas, mt.evidencias_fotos_total
        """,
        f"""
        CREATE OR REPLACE VIEW bi_incidencias AS
        SELECT
            r.fecha,
            EXTRACT(YEAR FROM r.fecha)::int AS anio,
            EXTRACT(MONTH FROM r.fecha)::int AS mes,
            EXTRACT(WEEK FROM r.fecha)::int AS semana_iso,
            {day_name} AS dia_semana,
            ri.created_at AT TIME ZONE 'America/La_Paz' AS hora_reporte,
            r.id::text AS ruta_id,
            v.id::text AS visita_id,
            ri.id::text AS incidencia_id,
            rep.supervisor,
            rep.nombre AS reponedor,
            p.codigo AS pdv_codigo,
            p.nombre AS pdv_nombre,
            p.mercado,
            p.tipo_cliente::text AS tipo_cliente,
            ri.categoria,
            ri.severidad,
            ri.estado,
            ri.afecta_entrega,
            ri.cantidad_afectada,
            ri.descripcion,
            ri.accion_tomada,
            ri.latitud,
            ri.longitud,
            ri.foto_url
        FROM reporte_incidencia ri
        JOIN visita v ON v.id = ri.visita_id
        JOIN ruta r ON r.id = v.ruta_id
        JOIN reponedor rep ON rep.id = ri.reponedor_id
        JOIN pdv p ON p.id = ri.pdv_id
        """,
    ]
    for statement in statements:
        with engine.begin() as conn:
            conn.execute(text(statement))


def init_db(max_attempts: int = 30) -> None:
    from app import models  # noqa: F401

    last_error: Exception | None = None
    for _ in range(max_attempts):
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            Base.metadata.create_all(bind=engine)
            run_lightweight_migrations()
            create_bi_views()
            return
        except Exception as exc:  # pragma: no cover - startup resilience
            last_error = exc
            time.sleep(1)
    raise RuntimeError("Database did not become ready") from last_error
