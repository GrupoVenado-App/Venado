import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { FeatureCollection } from "../types";

interface ReponedorResumen {
  id: string;
  nombre: string;
  supervisor: string;
  vehiculo_tipo: string | null;
  estado_ruta: string;
  ruta_id: string | null;
  pdvs_asignados: number;
  pdvs_completados: number;
  pdvs_en_progreso: number;
  pdvs_pendientes: number;
  km_recorridos: number;
  km_asignados: number;
  tiempo_total_estimado_min: number;
  tiempo_total_real_min: number | null;
  ultima_ubicacion: { latitud: number; longitud: number } | null;
  micro_tareas_completadas: number;
  micro_tareas_total: number;
}

interface ResumenGeneral {
  total_reponedores: number;
  pdvs_planificados: number;
  pdvs_completados: number;
  pdvs_pendientes: number;
  pdvs_en_progreso: number;
  km_totales: number;
  tiempo_total_min: number;
}

interface ReportesData {
  fecha: string;
  resumen: ResumenGeneral;
  reponedores: ReponedorResumen[];
}

const ESTADO_COLOR: Record<string, string> = {
  COMPLETADA: "#16a34a",
  EN_EJECUCION: "#2563eb",
  PLANIFICADA: "#f59e0b",
  CANCELADA: "#dc2626",
  SIN_RUTA: "#94a3b8",
};

const ESTADO_LABEL: Record<string, string> = {
  COMPLETADA: "Completada",
  EN_EJECUCION: "En ruta",
  PLANIFICADA: "Planificada",
  CANCELADA: "Cancelada",
  SIN_RUTA: "Sin ruta",
};

function KpiCard({
  label,
  value,
  sub,
  color = "bg-white",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`${color} rounded-xl border border-slate-200 p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <span className="rounded-lg bg-slate-100 p-2">
          <Icon size={20} className="text-slate-600" />
        </span>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLOR[estado] || "#94a3b8";
  const label = ESTADO_LABEL[estado] || estado;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

export function ReportesPage() {
  const [data, setData] = useState<ReportesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useGlobalFecha();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api
      .get<ReportesData>("/dashboard/reportes-reponedores", { params: fecha ? { fecha } : {} })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [fecha]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      api
        .get<ReportesData>("/dashboard/reportes-reponedores", { params: fecha ? { fecha } : {} })
        .then(({ data }) => setData(data));
    }, 30000);
    return () => clearInterval(interval);
  }, [fecha]);

  const mapData = useMemo<{ pdvs: FeatureCollection }>(() => {
    if (!data) return { pdvs: { type: "FeatureCollection", features: [] } };
    const features = data.reponedores
      .filter((r) => r.ultima_ubicacion)
      .map((r) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [r.ultima_ubicacion!.longitud, r.ultima_ubicacion!.latitud],
        },
        properties: {
          id: r.id,
          codigo: r.nombre,
          mercado: r.supervisor,
          tipo_cliente: "PARETO",
        },
      }));
    return { pdvs: { type: "FeatureCollection", features } };
  }, [data]);

  // Chart data
  const barData = useMemo(() => {
    if (!data) return [];
    return data.reponedores.map((r) => ({
      nombre: r.nombre.split(" ").slice(0, 2).join(" "),
      Completados: r.pdvs_completados,
      Pendientes: r.pdvs_pendientes,
      "En progreso": r.pdvs_en_progreso,
    }));
  }, [data]);

  const pieData = useMemo(() => {
    if (!data?.resumen) return [];
    return [
      { name: "Completados", value: data.resumen.pdvs_completados, color: "#16a34a" },
      { name: "En progreso", value: data.resumen.pdvs_en_progreso, color: "#2563eb" },
      { name: "Pendientes", value: data.resumen.pdvs_pendientes, color: "#f59e0b" },
    ].filter((d) => d.value > 0);
  }, [data]);

  const eficienciaData = useMemo(() => {
    if (!data) return [];
    return data.reponedores.map((r) => ({
      nombre: r.nombre.split(" ").slice(0, 2).join(" "),
      eficiencia:
        r.pdvs_asignados > 0 ? Math.round((r.pdvs_completados / r.pdvs_asignados) * 100) : 0,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { resumen } = data;
  const cobertura =
    resumen.pdvs_planificados > 0
      ? Math.round((resumen.pdvs_completados / resumen.pdvs_planificados) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes en Tiempo Real</h1>
          <p className="text-sm text-slate-500">
            Actualización automática cada 30 segundos · {data.fecha}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium"
          />
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="En vivo" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        <KpiCard
          label="Reponedores"
          value={resumen.total_reponedores}
          sub="activos hoy"
          icon={Users}
        />
        <KpiCard
          label="PDVs visitados"
          value={`${resumen.pdvs_completados}/${resumen.pdvs_planificados}`}
          sub={`${cobertura}% cobertura`}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Pendientes"
          value={resumen.pdvs_pendientes}
          sub="aún sin visitar"
          icon={AlertCircle}
        />
        <KpiCard
          label="Km recorridos"
          value={`${resumen.km_totales.toFixed(1)}`}
          sub="total del día"
          icon={Navigation}
        />
      </div>

      {/* Progress bar overall */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span className="text-slate-700">Cobertura global del día</span>
          <span className="text-slate-900">{cobertura}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${cobertura}%` }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {resumen.pdvs_completados} completados
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {resumen.pdvs_en_progreso} en progreso
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {resumen.pdvs_pendientes} pendientes
          </span>
        </div>
      </div>

      {/* Individual reponedor cards */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">Reponedores</h2>
        <div className="space-y-3">
          {data.reponedores.map((rep) => {
            const pct =
              rep.pdvs_asignados > 0
                ? Math.round((rep.pdvs_completados / rep.pdvs_asignados) * 100)
                : 0;
            return (
              <article
                key={rep.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{rep.nombre}</span>
                      <EstadoBadge estado={rep.estado_ruta} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Supervisor: {rep.supervisor}
                      {rep.vehiculo_tipo && ` · ${rep.vehiculo_tipo}`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      navigate(`/dashboard/reportes/${rep.id}`, {
                        state: { fecha, reponedorNombre: rep.nombre },
                      })
                    }
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                  >
                    Ver detalle <ChevronRight size={14} />
                  </button>
                </div>

                {/* Stats row */}
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">PDVs</p>
                    <p className="font-bold text-slate-900">
                      {rep.pdvs_completados}/{rep.pdvs_asignados}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Km asignados</p>
                    <p className="font-bold text-slate-900">{rep.km_asignados.toFixed(1)} km</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Tiempo est.</p>
                    <p className="font-bold text-slate-900">{rep.tiempo_total_estimado_min} min</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Micro-tareas</p>
                    <p className="font-bold text-slate-900">
                      {rep.micro_tareas_completadas}/{rep.micro_tareas_total}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Progreso</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: ESTADO_COLOR[rep.estado_ruta] || "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Global map */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">
          Ubicaciones actuales (último check-in)
        </h2>
        <MapaLaPaz pdvs={mapData.pdvs} heightClass="h-[380px]" zoom={12} />
        <p className="mt-1 text-xs text-slate-400">
          Los puntos muestran la última posición registrada de cada reponedor al iniciar una visita.
        </p>
      </section>

      {/* Charts */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Bar chart: PDVs per reponedor */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <BarChart2 size={16} /> PDVs por reponedor
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Completados" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="En progreso" stackId="a" fill="#2563eb" />
              <Bar dataKey="Pendientes" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: global estado */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Activity size={16} /> Distribución global de visitas
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart: eficiencia */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
            <TrendingUp size={16} /> Eficiencia por reponedor (% completado)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={eficienciaData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="eficiencia" fill="#2563eb" radius={[0, 4, 4, 0]}>
                {eficienciaData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.eficiencia >= 80
                        ? "#16a34a"
                        : entry.eficiencia >= 50
                        ? "#2563eb"
                        : "#f59e0b"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
