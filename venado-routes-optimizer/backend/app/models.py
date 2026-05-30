import enum
import uuid

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class TipoCliente(str, enum.Enum):
    PARETO = "PARETO"
    MAYORISTA = "MAYORISTA"
    MINORISTA = "MINORISTA"
    DETALLISTA = "DETALLISTA"


class RutaEstado(str, enum.Enum):
    PLANIFICADA = "PLANIFICADA"
    EN_EJECUCION = "EN_EJECUCION"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"


class VisitaEstado(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    NO_VISITADO = "NO_VISITADO"


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PDV(Base, TimestampMixin):
    __tablename__ = "pdv"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(30), unique=True, index=True, nullable=False)
    codigo_interno = Column(String(50), nullable=True)
    nombre = Column(String(255), nullable=False)
    mercado = Column(String(120), index=True, nullable=False)
    direccion = Column(String(255), nullable=True)
    tipo_cliente = Column(Enum(TipoCliente, name="tipo_cliente"), index=True, nullable=False)
    ubicacion = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    supervisor = Column(String(120), index=True, nullable=False)
    reponedor_asignado = Column(String(120), index=True, nullable=False)
    tiempo_visita_estimado_min = Column(Integer, nullable=False)
    dias_atencion = Column(JSONB, nullable=False)
    frecuencia_semanal = Column(Integer, default=0, nullable=False)
    frecuencia_mensual = Column(Integer, default=0, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)

    visitas = relationship("Visita", back_populates="pdv")

class MicroTarea(Base):
    __tablename__ = "micro_tarea"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(180), nullable=False)
    tipo_cliente = Column(Enum(TipoCliente, name="tipo_cliente"), index=True, nullable=False)
    marca = Column(String(80), nullable=True)
    tiempo_estimado_minutos = Column(Integer, nullable=False)
    descripcion = Column(String(500), nullable=True)

    ejecuciones = relationship("EjecucionMicroTarea", back_populates="micro_tarea")


class Reponedor(Base, TimestampMixin):
    __tablename__ = "reponedor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(120), unique=True, nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    supervisor = Column(String(120), index=True, nullable=False)
    telefono = Column(String(50), default="", nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    vehiculo_tipo = Column(String(80), nullable=True)

    rutas = relationship("Ruta", back_populates="reponedor")


class Supervisor(Base, TimestampMixin):
    __tablename__ = "supervisor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(120), unique=True, nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)


class Ruta(Base):
    __tablename__ = "ruta"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reponedor_id = Column(UUID(as_uuid=True), ForeignKey("reponedor.id"), nullable=False, index=True)
    fecha = Column(Date, index=True, nullable=False)
    dia_semana = Column(String(20), nullable=False)
    estado = Column(Enum(RutaEstado, name="ruta_estado"), default=RutaEstado.PLANIFICADA, index=True, nullable=False)
    distancia_total_km = Column(Float, default=0, nullable=False)
    tiempo_total_estimado_min = Column(Integer, default=0, nullable=False)
    tiempo_total_real_min = Column(Integer, nullable=True)
    pdvs_ordenados = Column(JSONB, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    reponedor = relationship("Reponedor", back_populates="rutas")
    visitas = relationship("Visita", back_populates="ruta", cascade="all, delete-orphan", order_by="Visita.orden_planificado")


class Visita(Base):
    __tablename__ = "visita"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ruta_id = Column(UUID(as_uuid=True), ForeignKey("ruta.id"), nullable=False, index=True)
    pdv_id = Column(UUID(as_uuid=True), ForeignKey("pdv.id"), nullable=False, index=True)
    orden_planificado = Column(Integer, nullable=False)
    estado = Column(Enum(VisitaEstado, name="visita_estado"), default=VisitaEstado.PENDIENTE, index=True, nullable=False)
    hora_inicio_real = Column(DateTime(timezone=True), nullable=True)
    hora_fin_real = Column(DateTime(timezone=True), nullable=True)
    tiempo_ejecucion_min = Column(Integer, nullable=True)
    coordenada_checkin = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    coordenada_checkout = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    distancia_desde_anterior_km = Column(Float, nullable=True)
    tiempo_traslado_desde_anterior_min = Column(Integer, nullable=True)
    foto_url = Column(String(500), nullable=True)

    ruta = relationship("Ruta", back_populates="visitas")
    pdv = relationship("PDV", back_populates="visitas")
    ejecuciones = relationship("EjecucionMicroTarea", back_populates="visita", cascade="all, delete-orphan")


class EjecucionMicroTarea(Base):
    __tablename__ = "ejecucion_micro_tarea"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visita_id = Column(UUID(as_uuid=True), ForeignKey("visita.id"), nullable=False, index=True)
    micro_tarea_id = Column(UUID(as_uuid=True), ForeignKey("micro_tarea.id"), nullable=False, index=True)
    hora_inicio = Column(DateTime(timezone=True), nullable=True)
    hora_fin = Column(DateTime(timezone=True), nullable=True)
    tiempo_real_min = Column(Integer, nullable=True)
    completada = Column(Boolean, default=False, nullable=False)
    foto_evidencia_url = Column(String(500), nullable=True)

    visita = relationship("Visita", back_populates="ejecuciones")
    micro_tarea = relationship("MicroTarea", back_populates="ejecuciones")


class HistorialTiempo(Base):
    __tablename__ = "historial_tiempo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    micro_tarea_id = Column(UUID(as_uuid=True), ForeignKey("micro_tarea.id"), nullable=False, index=True)
    pdv_tipo_cliente = Column(Enum(TipoCliente, name="tipo_cliente"), index=True, nullable=False)
    tiempo_promedio_real_min = Column(Float, nullable=False)
    cantidad_muestras = Column(Integer, default=1, nullable=False)
    fecha_calculo = Column(Date, nullable=False, index=True)
    semana_anio = Column(Integer, nullable=False, index=True)

    micro_tarea = relationship("MicroTarea")
