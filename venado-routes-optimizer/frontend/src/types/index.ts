export type TipoCliente = "PARETO" | "MAYORISTA" | "MINORISTA" | "DETALLISTA";
export type EstadoVisita = "PENDIENTE" | "EN_TRASLADO" | "EN_PROGRESO" | "COMPLETADA" | "NO_VISITADO";
export type EstadoRuta = "PLANIFICADA" | "EN_EJECUCION" | "COMPLETADA" | "CANCELADA";

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: "supervisor" | "reponedor";
  supervisor?: string | null;
}

export interface PDV {
  id: string;
  codigo: string;
  codigo_interno?: string | null;
  nombre: string;
  mercado: string;
  tipo_cliente: TipoCliente;
  latitud: number;
  longitud: number;
  supervisor: string;
  reponedor_asignado: string;
  tiempo_visita_estimado_min: number;
  dias_atencion: Record<string, number>;
  frecuencia_semanal: number;
  frecuencia_mensual: number;
  activo: boolean;
}

export interface Reponedor {
  id: string;
  nombre: string;
  email: string;
  supervisor: string;
  telefono: string;
  activo: boolean;
  vehiculo_tipo?: string | null;
}

export interface Visita {
  id: string;
  orden_planificado: number;
  estado: EstadoVisita;
  hora_inicio_real?: string | null;
  hora_fin_real?: string | null;
  tiempo_ejecucion_min?: number | null;
  hora_inicio_traslado?: string | null;
  hora_fin_traslado?: string | null;
  tiempo_traslado_real_min?: number | null;
  distancia_desde_anterior_km?: number | null;
  tiempo_traslado_desde_anterior_min?: number | null;
  ors_distancia_desde_anterior_km?: number | null;
  ors_tiempo_traslado_desde_anterior_min?: number | null;
  traslado_fuente?: string | null;
  pdv: Pick<PDV, "id" | "codigo" | "nombre" | "mercado" | "tipo_cliente" | "latitud" | "longitud" | "tiempo_visita_estimado_min">;
}

export interface Ruta {
  id: string;
  reponedor_id: string;
  reponedor?: { id: string; nombre: string; supervisor: string } | null;
  fecha: string;
  dia_semana: string;
  estado: EstadoRuta;
  distancia_total_km: number;
  tiempo_total_estimado_min: number;
  tiempo_total_real_min?: number | null;
  pdvs_ordenados: Array<Record<string, unknown>>;
  visitas: Visita[];
}

export interface MicroTareaEjecucion {
  id: string;
  visita_id: string;
  micro_tarea_id: string;
  nombre: string;
  marca?: string | null;
  tiempo_estimado_minutos: number;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  tiempo_real_min?: number | null;
  completada: boolean;
  foto_evidencia_url?: string | null;
}

export interface DashboardResumen {
  fecha: string;
  total_pdvs_planificados: number;
  total_visitas_completadas: number;
  total_en_progreso: number;
  total_reponedores_activos: number;
  km_totales_recorridos: number;
  tiempo_efectivo_total: number;
  cobertura_porcentaje: number;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point" | "LineString"; coordinates: [number, number] | Array<[number, number]> };
    properties: Record<string, string | number | boolean | null>;
  }>;
}
