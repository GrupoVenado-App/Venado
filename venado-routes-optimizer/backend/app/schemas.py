from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import RutaEstado, TipoCliente, VisitaEstado


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=3)


class UserOut(BaseModel):
    id: UUID
    nombre: str
    email: str
    rol: str
    supervisor: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    user: UserOut


class PDVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    codigo_interno: str | None = None
    nombre: str
    mercado: str
    direccion: str | None = None
    tipo_cliente: TipoCliente
    latitud: float
    longitud: float
    supervisor: str
    reponedor_asignado: str
    tiempo_visita_estimado_min: int
    dias_atencion: dict
    frecuencia_semanal: int
    frecuencia_mensual: int
    activo: bool


class MicroTareaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    tipo_cliente: TipoCliente
    marca: str | None = None
    tiempo_estimado_minutos: int
    descripcion: str | None = None


class ReponedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    email: str
    supervisor: str
    telefono: str
    activo: bool
    vehiculo_tipo: str | None = None


class SupervisorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    email: str
    activo: bool


class OptimizarRequest(BaseModel):
    fecha: date
    pdv_ids: list[UUID]
    reponedor_ids: list[UUID]
    criterio: str = "MINIMIZAR_TIEMPO_TOTAL"


class LocationIn(BaseModel):
    latitud: float
    longitud: float
    tiempo_traslado_real_min: int | None = None  # from chronometer or simulation
    simular: bool = False  # True when using Simular button


class FotoIn(BaseModel):
    foto_base64: str | None = None


class VisitaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ruta_id: UUID
    pdv_id: UUID
    orden_planificado: int
    estado: VisitaEstado
    hora_inicio_real: datetime | None = None
    hora_fin_real: datetime | None = None
    tiempo_ejecucion_min: int | None = None
    distancia_desde_anterior_km: float | None = None
    tiempo_traslado_desde_anterior_min: int | None = None
    foto_url: str | None = None
    pdv: PDVOut | None = None


class RutaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reponedor_id: UUID
    fecha: date
    dia_semana: str
    estado: RutaEstado
    distancia_total_km: float
    tiempo_total_estimado_min: int
    tiempo_total_real_min: int | None = None
    pdvs_ordenados: list[dict]
    visitas: list[VisitaOut] = []


class EjecucionMicroTareaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    visita_id: UUID
    micro_tarea_id: UUID
    hora_inicio: datetime | None = None
    hora_fin: datetime | None = None
    tiempo_real_min: int | None = None
    completada: bool
    foto_evidencia_url: str | None = None
    micro_tarea: MicroTareaOut
