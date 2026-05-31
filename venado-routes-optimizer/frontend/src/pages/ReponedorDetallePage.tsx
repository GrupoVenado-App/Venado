import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  ImageIcon,
  MapPin,
  Navigation,
  Route,
  Timer,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, assetUrl } from "../api/client";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { FeatureCollection } from "../types";

interface EjecucionDetalle {
  nombre_tarea: string;
  completada: boolean;
  tiempo_real_min: number | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  foto_evidencia_url: string | null;
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
  pdv_tiempo_estimado_min: number;
  hora_inicio_real: string | null;
  hora_fin_real: string | null;
  tiempo_ejecucion_min: number | null;
  tiempo_traslado_real_min: number | null;
  tiempo_traslado_planificado_min: number | null;
  distancia_planificada_km: number | null;
  traslado_fuente: string | null;
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
  ruta_planificada_ors: boolean;
  ruta_real_ors: boolean;
  tiempo_en_ruta_min: number;
  tiempo_en_microtareas_min: number;
  micro_tareas_total: number;
  micro_tareas_completadas: number;
  fotos_total: number;
  desviaciones_tiempo: number;
}

const ESTADO_COLOR: Record<string, string> = {
  COMPLETADA: "text-blue-700 bg-blue-50 border-blue-200",
  EN_PROGRESO: "text-blue-700 bg-blue-50 border-blue-200",
  EN_TRASLADO: "text-skyroute bg-blue-50 border-blue-200",
  PENDIENTE: "text-slate-600 bg-slate-50 border-slate-200",
  NO_VISITADO: "text-red-700 bg-red-50 border-red-200",
};

const ESTADO_LABEL: Record<string, string> = {
  COMPLETADA: "Completada",
  EN_PROGRESO: "En progreso",
  EN_TRASLADO: "En traslado",
  PENDIENTE: "Pendiente",
  NO_VISITADO: "No visitado",
};

const ESTADO_CHART_COLORS: Record<string, string> = {
  COMPLETADA: "#174ea6",
  EN_PROGRESO: "#2563eb",
  EN_TRASLADO: "#1d4ed8",
  PENDIENTE: "#c8102e",
  NO_VISITADO: "#dc2626",
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-slate-400" />
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

export function ReponedorDetallePage() {
  const { reponedorId } = useParams<{ reponedorId: string }>();
  const navigate = useNavigate();
  const [fecha] = useGlobalFecha();
  const [data, setData] = useState<DetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComparacion, setShowComparacion] = useState(true);

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

  const mapData = useMemo(() => {
    if (!data) {
      return {
        pdvs: null as FeatureCollection | null,
        rutaPlanificada: null as FeatureCollection | null,
      };
    }

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
                properties: {
                  reponedor: data.reponedor.nombre,
                  ruta_id: data.ruta?.id || "",
                  ors_geometry: data.ruta_planificada_ors,
                },
              },
            ],
          }
        : null;

    return { pdvs: pdvFeatures, rutaPlanificada };
  }, [data]);

  const ultimaUbicacion = useMemo(() => {
    if (!data) return null;
    const visitasConCheckin = data.visitas
      .filter((v) => v.checkin_latitud !== null)
      .sort((a, b) => b.orden_planificado - a.orden_planificado);
    if (!visitasConCheckin.length) return null;
    const last = visitasConCheckin[0];
    return { latitud: last.checkin_latitud!, longitud: last.checkin_longitud! };
  }, [data]);

  const rutaRealCoords = useMemo<[number, number][] | null>(() => {
    if (!data || data.ruta_real_coords.length < 2) return null;
    return data.ruta_real_coords;
  }, [data]);

  const estadoData = useMemo(() => {
    if (!data) return [];
    const counts = data.visitas.reduce<Record<string, number>>((acc, visita) => {
      acc[visita.estado] = (acc[visita.estado] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([estado, value]) => ({
      name: ESTADO_LABEL[estado] || estado,
      value,
      color: ESTADO_CHART_COLORS[estado] || "#64748b",
    }));
  }, [data]);

  const tiempoData = useMemo(() => {
    if (!data) return [];
    const planTraslado = data.visitas.reduce((sum, v) => sum + (v.tiempo_traslado_planificado_min || 0), 0);
    const planPdv = data.visitas.reduce((sum, v) => sum + (v.pdv_tiempo_estimado_min || 0), 0);
    return [
      { tipo: "Traslado", Planificado: planTraslado, Real: data.tiempo_en_ruta_min },
      { tipo: "PDV", Planificado: planPdv, Real: data.tiempo_en_microtareas_min },
    ];
  }, [data]);

  const evidencias = useMemo(() => {
    if (!data) return [];
    return data.visitas.flatMap((visita) =>
      visita.ejecuciones
        .filter((ejecucion) => ejecucion.foto_evidencia_url)
        .map((ejecucion) => ({
          visita,
          ejecucion,
          url: assetUrl(ejecucion.foto_evidencia_url),
        })),
    );
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rutaCompletada = data.ruta?.estado === "COMPLETADA";
  const pdvsCompletados = data.visitas.filter((v) => v.estado === "COMPLETADA").length;
  const cobertura = data.visitas.length > 0 ? Math.round((pdvsCompletados / data.visitas.length) * 100) : 0;
  const hasPlannedRoute = data.ruta_planificada_coords.length >= 2;
  const hasRealRoute = data.ruta_real_coords.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard/reportes")}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{data.reponedor.nombre}</h1>
          <p className="text-xs text-slate-500">
            Supervisor: {data.reponedor.supervisor} - {data.fecha}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          En vivo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="PDVs completados"
          value={`${pdvsCompletados}/${data.visitas.length}`}
          icon={CheckCircle2}
          color={cobertura >= 80 ? "text-blue-700" : cobertura >= 50 ? "text-skyroute" : "text-red-700"}
        />
        <StatCard label="Tiempo en ruta" value={`${data.tiempo_en_ruta_min} min`} icon={Navigation} />
        <StatCard label="Tiempo en PDVs" value={`${data.tiempo_en_microtareas_min} min`} icon={Timer} />
        <StatCard label="Micro-tareas" value={`${data.micro_tareas_completadas}/${data.micro_tareas_total}`} icon={Clock} />
        <StatCard label="Fotos" value={data.fotos_total} icon={Camera} color="text-skyroute" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <MapPin size={16} /> Mapa en vivo - Ruta planificada y ubicacion actual
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            Plan: {data.ruta_planificada_ors ? "ORS por calles" : "linea local"} | Real:{" "}
            {data.ruta_real_ors ? "ORS por calles" : "checkins"}
          </span>
        </div>
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
            <span className="inline-block h-1 w-6 rounded-full bg-blue-500" style={{ borderTop: "2px dashed #2563eb" }} /> Ruta real
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2 border-slate-900 bg-sky-400" /> Ultima ubicacion
          </span>
        </div>
      </section>

      {hasPlannedRoute && hasRealRoute ? (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-blue-800">
              <Route size={16} /> {rutaCompletada ? "Ruta completada" : "Avance de ruta"} - Comparacion planificada vs real
            </h2>
            <button
              onClick={() => setShowComparacion(!showComparacion)}
              className="rounded-lg bg-skyroute px-3 py-1.5 text-xs font-bold text-white hover:bg-venado"
            >
              {showComparacion ? "Ocultar" : "Ver comparacion"}
            </button>
          </div>
          {showComparacion ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold text-red-700">Ruta planificada ({data.ruta_planificada_ors ? "ORS" : "local"})</p>
                <MapaLaPaz pdvs={mapData.pdvs} rutas={mapData.rutaPlanificada} heightClass="h-[280px]" zoom={13} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-blue-700">Ruta real ({data.ruta_real_ors ? "ORS" : "checkins"})</p>
                <MapaLaPaz pdvs={mapData.pdvs} navRoute={rutaRealCoords} heightClass="h-[280px]" zoom={13} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Timer size={16} /> Plan vs real por tipo de tiempo
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tiempoData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${value} min`} />
              <Bar dataKey="Planificado" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Real" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <CheckCircle2 size={16} /> Estado de visitas
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={estadoData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                {estadoData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {data.desviaciones_tiempo > 0 ? (
            <p className="mt-2 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
              <AlertTriangle size={13} /> {data.desviaciones_tiempo} desvio(s) de tiempo detectados
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <ImageIcon size={16} /> Evidencias fotograficas
          </h2>
          <span className="text-xs font-semibold text-slate-500">{evidencias.length} fotos</span>
        </div>
        {evidencias.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {evidencias.map(({ visita, ejecucion, url }) => (
              <a
                key={`${visita.id}-${ejecucion.nombre_tarea}`}
                href={url || "#"}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <img src={url || ""} alt={ejecucion.nombre_tarea} className="h-28 w-full object-cover transition group-hover:scale-105" />
                <div className="p-2">
                  <p className="truncate text-xs font-bold text-slate-800">{visita.pdv_codigo}</p>
                  <p className="truncate text-[11px] text-slate-500">{ejecucion.nombre_tarea}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
            Todavia no hay fotos cargadas en las micro-tareas de esta ruta.
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">Secuencia de visitas</h2>
        <div className="space-y-3">
          {data.visitas.map((visita) => (
            <article
              key={visita.id}
              className={`rounded-lg border p-4 shadow-sm ${ESTADO_COLOR[visita.estado] || ESTADO_COLOR.PENDIENTE}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-slate-700">
                      {visita.orden_planificado}
                    </span>
                    <span className="font-bold">{visita.pdv_codigo}</span>
                    <span className="text-xs">- {visita.pdv_mercado}</span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-70">{visita.pdv_nombre}</p>
                </div>
                <span className="shrink-0 rounded-full border bg-white/50 px-2 py-0.5 text-xs font-bold">
                  {ESTADO_LABEL[visita.estado] || visita.estado}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div>
                  <p className="opacity-60">Traslado plan</p>
                  <p className="font-semibold">{visita.tiempo_traslado_planificado_min ?? "-"} min</p>
                </div>
                <div>
                  <p className="opacity-60">Traslado real</p>
                  <p className="font-semibold">{visita.tiempo_traslado_real_min ?? "-"} min</p>
                </div>
                <div>
                  <p className="opacity-60">Inicio</p>
                  <p className="font-semibold">{formatTime(visita.hora_inicio_real)}</p>
                </div>
                <div>
                  <p className="opacity-60">Tiempo PDV</p>
                  <p className="font-semibold">{visita.tiempo_ejecucion_min != null ? `${visita.tiempo_ejecucion_min} min` : "-"}</p>
                </div>
              </div>

              {visita.ejecuciones.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {visita.ejecuciones.map((e, idx) => {
                    const url = assetUrl(e.foto_evidencia_url);
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-2 py-1 text-xs">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {e.completada ? (
                            <CheckCircle2 size={12} className="shrink-0 text-blue-600" />
                          ) : (
                            <XCircle size={12} className="shrink-0 text-slate-400" />
                          )}
                          <span className={`truncate ${e.completada ? "font-medium" : "opacity-60"}`}>{e.nombre_tarea}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="opacity-70">{e.tiempo_real_min != null ? `${e.tiempo_real_min} min` : "-"}</span>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded border border-white shadow-sm">
                              <img src={url} alt={e.nombre_tarea} className="h-10 w-12 object-cover" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
