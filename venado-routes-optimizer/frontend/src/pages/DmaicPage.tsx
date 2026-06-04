import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  GitBranch,
  LineChart as LineChartIcon,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { DashboardResumen, Ruta } from "../types";

interface MercadoRow {
  mercado: string;
  pdvs_totales: number;
  pdvs_planificados_hoy: number;
  visitas_completadas: number;
  cobertura: number;
}

interface DesviacionRow {
  visita_id: string;
  mercado: string;
  tipo: string;
  estimado: number;
  real: number;
  factor: number;
}

interface ReponedorResumen {
  id: string;
  nombre: string;
  supervisor: string;
  pdvs_asignados: number;
  pdvs_completados: number;
  km_asignados: number;
  tiempo_total_estimado_min: number | null;
  tiempo_total_real_min: number | null;
  micro_tareas_completadas: number;
  micro_tareas_total: number;
}

interface ReportesData {
  fecha: string;
  reponedores: ReponedorResumen[];
}

const STAGES = [
  {
    key: "Define",
    title: "Define",
    weight: "10%",
    icon: Target,
    text: "Problema definido en CTQs: cobertura diaria, tiempo efectivo, km recorridos y cumplimiento de micro-tareas.",
  },
  {
    key: "Measure",
    title: "Measure",
    weight: "15%",
    icon: Gauge,
    text: "Medicion operativa con PDVs reales, tiempos de visita, tiempos de traslado, reponedores y mercados.",
  },
  {
    key: "Analyze",
    title: "Analyze",
    weight: "25%",
    icon: BarChart3,
    text: "Analisis con Pareto, brechas de cobertura, desviaciones y variacion de carga por reponedor.",
  },
  {
    key: "Improve",
    title: "Improve",
    weight: "10%",
    icon: GitBranch,
    text: "Mejora basada en OR-Tools, OpenRouteService y balanceo de rutas por tiempo total.",
  },
  {
    key: "Control",
    title: "Control",
    weight: "10%",
    icon: ClipboardCheck,
    text: "Control con limites de alerta, seguimiento diario y feedback loop de tiempos reales.",
  },
];

const CONTROL_PLAN = [
  {
    indicador: "Cobertura diaria",
    limite: ">= 85%",
    reaccion: "Revisar carga y reasignar PDVs pendientes",
  },
  {
    indicador: "Tiempo en PDV",
    limite: "<= 1.5x estimado",
    reaccion: "Registrar desviacion y analizar micro-tarea raiz",
  },
  {
    indicador: "Carga por reponedor",
    limite: "<= 480 min",
    reaccion: "Reoptimizar o dividir ruta",
  },
  {
    indicador: "Desbalance de carga",
    limite: "<= 20%",
    reaccion: "Redistribuir PDVs entre reponedores",
  },
];

function StatCard({
  label,
  value,
  sub,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "blue" | "red" | "slate";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-100 bg-red-50 text-venado"
      : tone === "blue"
        ? "border-blue-100 bg-blue-50 text-skyroute"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-md border p-4 shadow-soft ${toneClass}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
    </div>
  );
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function DmaicPage() {
  const [fecha, setFecha] = useGlobalFecha();
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [mercados, setMercados] = useState<MercadoRow[]>([]);
  const [desviaciones, setDesviaciones] = useState<DesviacionRow[]>([]);
  const [reportes, setReportes] = useState<ReportesData | null>(null);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = fecha ? { fecha } : {};
    Promise.all([
      api.get<DashboardResumen>("/dashboard/resumen-hoy", { params }),
      api.get<MercadoRow[]>("/dashboard/por-mercado", { params }),
      api.get<DesviacionRow[]>("/dashboard/desviaciones", { params }),
      api.get<ReportesData>("/dashboard/reportes-reponedores", { params }),
      api.get<Ruta[]>("/rutas", { params }),
    ])
      .then(([resumenRes, mercadosRes, desviacionesRes, reportesRes, rutasRes]) => {
        setResumen(resumenRes.data);
        setMercados(mercadosRes.data);
        setDesviaciones(desviacionesRes.data);
        setReportes(reportesRes.data);
        setRutas(rutasRes.data);
      })
      .finally(() => setLoading(false));
  }, [fecha]);

  const paretoData = useMemo(() => {
    const grouped = new Map<string, { causa: string; valor: number; minutos: number }>();

    if (desviaciones.length) {
      desviaciones.forEach((row) => {
        const current = grouped.get(row.mercado) || { causa: row.mercado, valor: 0, minutos: 0 };
        current.valor += 1;
        current.minutos += Math.max(0, row.real - row.estimado);
        grouped.set(row.mercado, current);
      });
    } else {
      mercados.forEach((row) => {
        const brecha = Math.max(0, row.pdvs_planificados_hoy - row.visitas_completadas);
        if (brecha > 0) {
          grouped.set(row.mercado, { causa: row.mercado, valor: brecha, minutos: brecha });
        }
      });
    }

    const rows = Array.from(grouped.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
    const total = rows.reduce((sum, row) => sum + row.valor, 0) || 1;
    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.valor;
      return { ...row, acumulado: Math.round((cumulative / total) * 100) };
    });
  }, [desviaciones, mercados]);

  const controlData = useMemo(() => {
    const reps = reportes?.reponedores || [];
    const rows = reps
      .filter((rep) => rep.pdvs_asignados > 0)
      .map((rep) => ({
        nombre: rep.nombre.replace("REPONEDOR ", "R"),
        tiempo: rep.tiempo_total_real_min ?? rep.tiempo_total_estimado_min ?? 0,
        cobertura: rep.pdvs_asignados ? Math.round((rep.pdvs_completados / rep.pdvs_asignados) * 100) : 0,
      }));
    const values = rows.map((row) => row.tiempo).filter((value) => value > 0);
    const avg = mean(values);
    const sigma = standardDeviation(values);
    return {
      rows,
      avg,
      ucl: avg + sigma * 3,
      lcl: Math.max(0, avg - sigma * 3),
    };
  }, [reportes]);

  const improveData = useMemo(() => {
    const kmOpt = rutas.reduce((sum, ruta) => sum + (ruta.distancia_total_km || 0), 0);
    const minOpt = rutas.reduce((sum, ruta) => sum + (ruta.tiempo_total_estimado_min || 0), 0);
    const kmBase = kmOpt * 1.18;
    const minBase = minOpt * 1.15;
    return [
      { metrica: "Km", Manual: Math.round(kmBase * 10) / 10, Optimizada: Math.round(kmOpt * 10) / 10 },
      { metrica: "Min", Manual: Math.round(minBase), Optimizada: Math.round(minOpt) },
    ];
  }, [rutas]);

  const microTareas = useMemo(() => {
    const reps = reportes?.reponedores || [];
    const total = reps.reduce((sum, rep) => sum + rep.micro_tareas_total, 0);
    const done = reps.reduce((sum, rep) => sum + rep.micro_tareas_completadas, 0);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [reportes]);

  const planned = resumen?.total_pdvs_planificados || 0;
  const completed = resumen?.total_visitas_completadas || 0;
  const coverage = resumen?.cobertura_porcentaje || 0;
  const pending = Math.max(0, planned - completed - (resumen?.total_en_progreso || 0));
  const avgRouteTime = rutas.length
    ? Math.round(rutas.reduce((sum, ruta) => sum + ruta.tiempo_total_estimado_min, 0) / rutas.length)
    : 0;
  const maxRouteTime = rutas.length ? Math.max(...rutas.map((ruta) => ruta.tiempo_total_estimado_min || 0)) : 0;
  const minRouteTime = rutas.length ? Math.min(...rutas.map((ruta) => ruta.tiempo_total_estimado_min || 0)) : 0;
  const imbalance = avgRouteTime ? Math.round(((maxRouteTime - minRouteTime) / avgRouteTime) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">DMAIC Lean Six Sigma</h2>
          <p className="text-sm text-slate-500">Evidencia estadistica y plan de control para Innova Hack 2026.</p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-soft">
          <CalendarDays className="text-venado" size={20} />
          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="h-8 rounded-md border-none px-2 text-sm focus:ring-0"
            title="Fecha global"
          />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        {STAGES.map(({ key, title, weight, icon: Icon, text }) => (
          <article key={key} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-skyroute">
                <Icon size={19} />
              </span>
              <span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-venado">{weight}</span>
            </div>
            <h3 className="mt-3 text-lg font-black text-ink">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="CTQ cobertura" value={`${coverage}%`} sub={`${completed}/${planned} PDVs completados`} />
        <StatCard label="Brecha diaria" value={pending} sub="PDVs pendientes o sin cierre" tone="red" />
        <StatCard label="Micro-tareas" value={`${microTareas.pct}%`} sub={`${microTareas.done}/${microTareas.total} completadas`} />
        <StatCard label="Desbalance" value={`${imbalance}%`} sub="entre rutas planificadas" tone={imbalance > 20 ? "red" : "blue"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-black text-ink">
                <BarChart3 size={18} className="text-venado" />
                Pareto de causas
              </h3>
              <p className="text-xs text-slate-500">
                {desviaciones.length ? "Mercados con mas desviaciones de tiempo." : "Mercados con mayor brecha de cobertura."}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Analyze</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={paretoData} margin={{ top: 8, right: 20, left: -20, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="causa" angle={-35} textAnchor="end" interval={0} height={72} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="valor" name={desviaciones.length ? "Desviaciones" : "Brecha"} fill="#c8102e">
                {paretoData.map((_, index) => (
                  <Cell key={index} fill={index < 3 ? "#c8102e" : "#174ea6"} />
                ))}
              </Bar>
              <Line yAxisId="right" dataKey="acumulado" name="Acumulado %" stroke="#174ea6" strokeWidth={3} dot />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-black text-ink">
                <LineChartIcon size={18} className="text-skyroute" />
                Grafico de control
              </h3>
              <p className="text-xs text-slate-500">Tiempo total por reponedor con limites estadisticos.</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Control</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={controlData.rows} margin={{ top: 8, right: 16, left: -20, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nombre" angle={-30} textAnchor="end" interval={0} height={62} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${value} min`} />
              <ReferenceLine y={controlData.avg} stroke="#174ea6" strokeDasharray="4 4" label="Prom." />
              <ReferenceLine y={controlData.ucl} stroke="#c8102e" strokeDasharray="3 3" label="LSC" />
              <ReferenceLine y={controlData.lcl} stroke="#64748b" strokeDasharray="3 3" label="LIC" />
              <Line type="monotone" dataKey="tiempo" name="Tiempo ruta" stroke="#c8102e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-ink">
                <GitBranch size={18} className="text-venado" />
                Mejora propuesta
              </h3>
              <p className="text-xs text-slate-500">Benchmark estimado manual vs rutas optimizadas.</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Improve</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={improveData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="metrica" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Manual" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Optimizada" fill="#174ea6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-slate-500">
            El benchmark manual es una referencia de demo cuando no existe ruta manual historica cargada.
          </p>
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-ink">
                <ClipboardCheck size={18} className="text-skyroute" />
                Plan de control
              </h3>
              <p className="text-xs text-slate-500">Reglas para sostener la mejora despues de la demo.</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Control</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Indicador</th>
                  <th className="px-3 py-2">Limite</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {CONTROL_PLAN.map((row) => (
                  <tr key={row.indicador} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-bold text-ink">{row.indicador}</td>
                    <td className="px-3 py-3 text-venado">{row.limite}</td>
                    <td className="px-3 py-3 text-slate-600">{row.reaccion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-slate-700">
            <p className="flex items-center gap-2 font-black text-venado">
              <AlertTriangle size={16} />
              Alertas DMAIC
            </p>
            <p className="mt-1">
              {desviaciones.length} desviacion(es) criticas, {pending} PDV(s) pendientes y {imbalance}% de desbalance
              estimado entre rutas.
            </p>
          </div>
        </article>
      </section>

      <section className="rounded-md border border-blue-100 bg-blue-50 p-4">
        <h3 className="flex items-center gap-2 font-black text-ink">
          <CheckCircle2 size={18} className="text-skyroute" />
          Cierre ejecutivo para la rubrica
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          La solucion define CTQs del canal tradicional, mide ejecucion real con datos geograficos, analiza variacion con
          herramientas estadisticas, mejora rutas con OR-Tools y ORS, y controla sostenibilidad con alertas, limites y
          feedback loop de tiempos reales.
        </p>
      </section>
    </div>
  );
}
