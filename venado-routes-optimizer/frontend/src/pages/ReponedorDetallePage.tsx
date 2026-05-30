import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Route,
  Timer,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { FeatureCollection } from "../types";

interface EjecucionDetalle {
  nombre_tarea: string;
  completada: boolean;
  tiempo_real_min: number | null;
  hora_inicio: string | null;
  hora_fin: string | null;
}

interface VisitaDetalle {
  id: string;
  orden_planificado: number;
  estado: string;
  pdv_codigo: string;
  pdv_nombre: string;
  pdv_mercado: string;
  pdv_tipo_cliente: string;
  pdv_latitud: number;
  pdv_longitud: number;
  hora_inicio_real: string | null;
  hora_fin_real: string | null;
  tiempo_ejecucion_min: number | null;
  tiempo_traslado_real_min: number | null;
  checkin_latitud: number | null;
  checkin_longitud: number | null;
  ejecuciones: EjecucionDetalle[];
}

interface DetalleData {
  reponedor: { id: string; nombre: string; supervisor: string; email: string; vehiculo_tipo: string | null };
  fecha: string;
  ruta: {
    id: string;
    estado: string;
    distancia_total_km: number;
    tiempo_total_estimado_min: number;
    tiempo_total_real_min: number | null;
    pdvs_ordenados: { pdv_id: string; codigo: string; orden: number; latitud?: number; longitud?: number }[];
  } | null;
  visitas: VisitaDetalle[];
  ruta_planificada_coords: [number, number][];
  ruta_real_coords: [number, number][];
  tiempo_en_ruta_min: number;
  tiempo_en_microtareas_min: number;
  micro_tareas_total: number;
  micro_tareas_completadas: number;
}

const ESTADO_COLOR: Record<string, string> = {
  COMPLETADA: "text-green-700 bg-green-50 border-green-200",
  EN_PROGRESO: "text-blue-700 bg-blue-50 border-blue-200",
  PENDIENTE: "text-slate-600 bg-slate-50 border-slate-200",
  NO_VISITADO: "text-red-700 bg-red-50 border-red-200",
};

const ESTADO_LABEL: Record<string, string> = {
  COMPLETADA: "✓ Completada",
  EN_PROGRESO: "⟳ En progreso",
  PENDIENTE: "◯ Pendiente",
  NO_VISITADO: "✗ No visitado",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-slate-900",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-slate-400" />
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function ReponedorDetallePage() {
  const { reponedorId } = useParams<{ reponedorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [fecha] = useGlobalFecha();
  const [data, setData] = useState<DetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComparacion, setShowComparacion] = useState(false);

  const reponedorNombre = (location.state as { reponedorNombre?: string })?.reponedorNombre;

  useEffect(() => {
    if (!reponedorId) return;
    setLoading(true);
    api
      .get<DetalleData>(`/dashboard/reponedor-detalle/${reponedorId}`, {
        params: fecha ? { fecha } : {},
      })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [reponedorId, fecha]);

  // Auto-refresh every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!reponedorId) return;
      api
        .get<DetalleData>(`/dashboard/reponedor-detalle/${reponedorId}`, {
          params: fecha ? { fecha } : {},
        })
        .then(({ data }) => setData(data));
    }, 20000);
    return () => clearInterval(interval);
  }, [reponedorId, fecha]);

  // Map data
  const mapData = useMemo(() => {
    if (!data) return { pdvs: null as FeatureCollection | null, rutaPlanificada: null as FeatureCollection | null, rutaReal: null as FeatureCollection | null };

    const pdvFeatures: FeatureCollection = {
      type: "FeatureCollection",
      features: data.visitas.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.pdv_longitud, v.pdv_latitud] },
        properties: {
          id: v.id,
          codigo: `${v.orden_planificado}. ${v.pdv_codigo}`,
          mercado: v.pdv_mercado,
          tipo_cliente: v.pdv_tipo_cliente,
          estado: v.estado,
        },
      })),
    };

    const rutaPlanificada: FeatureCollection | null =
      data.ruta_planificada_coords.length >= 2
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "LineString", coordinates: data.ruta_planificada_coords },
                properties: { reponedor: data.reponedor.nombre, ruta_id: data.ruta?.id || "" },
              },
            ],
          }
        : null;

    return { pdvs: pdvFeatures, rutaPlanificada };
  }, [data]);

  // Last known location
  const ultimaUbicacion = useMemo(() => {
    if (!data) return null;
    const visitasConCheckin = data.visitas
      .filter((v) => v.checkin_latitud !== null)
      .sort((a, b) => b.orden_planificado - a.orden_planificado);
    if (!visitasConCheckin.length) return null;
    const last = visitasConCheckin[0];
    return { latitud: last.checkin_latitud!, longitud: last.checkin_longitud! };
  }, [data]);

  // Route real coords as navRoute
  const rutaRealCoords = useMemo<[number, number][] | null>(() => {
    if (!data || data.ruta_real_coords.length < 2) return null;
    return data.ruta_real_coords;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rutaCompletada = data.ruta?.estado === "COMPLETADA";
  const pdvsCompletados = data.visitas.filter((v) => v.estado === "COMPLETADA").length;
  const cobertura =
    data.visitas.length > 0 ? Math.round((pdvsCompletados / data.visitas.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard/reportes")}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {data.reponedor.nombre}
          </h1>
          <p className="text-xs text-slate-500">
            Supervisor: {data.reponedor.supervisor} · {data.fecha}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          En vivo
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="PDVs completados"
          value={`${pdvsCompletados}/${data.visitas.length}`}
          icon={CheckCircle2}
          color={cobertura >= 80 ? "text-green-700" : cobertura >= 50 ? "text-blue-700" : "text-amber-700"}
        />
        <StatCard
          label="Tiempo en ruta"
          value={`${data.tiempo_en_ruta_min} min`}
          icon={Navigation}
        />
        <StatCard
          label="Tiempo en PDVs"
          value={`${data.tiempo_en_microtareas_min} min`}
          icon={Timer}
        />
        <StatCard
          label="Micro-tareas"
          value={`${data.micro_tareas_completadas}/${data.micro_tareas_total}`}
          icon={Clock}
        />
      </div>

      {/* Live map */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <MapPin size={16} /> Mapa en vivo — Ruta planificada y ubicación actual
        </h2>
        <MapaLaPaz
          pdvs={mapData.pdvs}
          rutas={mapData.rutaPlanificada}
          currentLocation={ultimaUbicacion}
          navRoute={rutaRealCoords}
          heightClass="h-[360px]"
          zoom={13}
        />
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-6 rounded-full bg-red-600" /> Ruta planificada
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-6 rounded-full bg-blue-500" style={{ borderTop: "2px dashed #2563eb" }} /> Ruta real (checkins)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-sky-400 border-2 border-slate-900" /> Última ubicación
          </span>
        </div>
      </section>

      {/* Comparación ruta cuando está completa */}
      {rutaCompletada && data.ruta_real_coords.length >= 2 && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-green-800">
              <Route size={16} /> Ruta completada — Comparación planificada vs real
            </h2>
            <button
              onClick={() => setShowComparacion(!showComparacion)}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-800"
            >
              {showComparacion ? "Ocultar" : "Ver comparación"}
            </button>
          </div>
          {showComparacion && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold text-green-700">📍 Ruta Planificada (ORS)</p>
                <MapaLaPaz
                  pdvs={mapData.pdvs}
                  rutas={mapData.rutaPlanificada}
                  heightClass="h-[280px]"
                  zoom={13}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-blue-700">🗺️ Ruta Real (checkins)</p>
                <MapaLaPaz
                  pdvs={mapData.pdvs}
                  navRoute={rutaRealCoords}
                  heightClass="h-[280px]"
                  zoom={13}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Visitas list */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">Secuencia de visitas</h2>
        <div className="space-y-3">
          {data.visitas.map((visita) => (
            <article
              key={visita.id}
              className={`rounded-xl border p-4 shadow-sm ${ESTADO_COLOR[visita.estado] || ESTADO_COLOR.PENDIENTE}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-slate-700">
                      {visita.orden_planificado}
                    </span>
                    <span className="font-bold">{visita.pdv_codigo}</span>
                    <span className="text-xs">· {visita.pdv_mercado}</span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-70">{visita.pdv_nombre}</p>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold">
                  {ESTADO_LABEL[visita.estado] || visita.estado}
                </span>
              </div>

              {/* Timing */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="opacity-60">Traslado</p>
                  <p className="font-semibold">
                    {visita.tiempo_traslado_real_min != null
                      ? `${visita.tiempo_traslado_real_min} min`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="opacity-60">Inicio</p>
                  <p className="font-semibold">
                    {visita.hora_inicio_real
                      ? new Date(visita.hora_inicio_real).toLocaleTimeString("es-BO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="opacity-60">Tiempo PDV</p>
                  <p className="font-semibold">
                    {visita.tiempo_ejecucion_min != null
                      ? `${visita.tiempo_ejecucion_min} min`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Micro-tareas */}
              {visita.ejecuciones.length > 0 && (
                <div className="mt-3 space-y-1">
                  {visita.ejecuciones.map((e, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-white/50 px-2 py-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        {e.completada ? (
                          <CheckCircle2 size={12} className="text-green-600 shrink-0" />
                        ) : (
                          <XCircle size={12} className="text-slate-400 shrink-0" />
                        )}
                        <span className={e.completada ? "font-medium" : "opacity-60"}>
                          {e.nombre_tarea}
                        </span>
                      </div>
                      <span className="opacity-70">
                        {e.tiempo_real_min != null ? `${e.tiempo_real_min} min` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
