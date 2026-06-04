import { AlertTriangle, CalendarDays, Download, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { api } from "../api/client";
import { useGlobalFecha } from "../hooks/useGlobalFecha";

interface IncidenciaResumenRow {
  nombre: string;
  total: number;
}

interface IncidenciaDetalle {
  id: string;
  created_at: string | null;
  reponedor: string;
  supervisor: string;
  pdv_codigo: string;
  pdv_nombre: string;
  mercado: string;
  tipo_cliente: string;
  categoria: string;
  severidad: string;
  estado: string;
  descripcion: string;
  accion_tomada: string;
  afecta_entrega: boolean;
  cantidad_afectada: number;
  foto_url?: string | null;
}

interface IncidenciasData {
  fecha: string;
  total: number;
  abiertas: number;
  criticas: number;
  afectan_entrega: number;
  por_categoria: IncidenciaResumenRow[];
  por_mercado: IncidenciaResumenRow[];
  por_severidad: IncidenciaResumenRow[];
  incidencias: IncidenciaDetalle[];
}

const CATEGORIA_LABEL: Record<string, string> = {
  FALTANTE_STOCK: "Faltante de stock",
  PRODUCTO_DANADO: "Producto dañado",
  MATERIAL_POP_DANADO: "Material POP dañado",
  EXHIBICION_BLOQUEADA: "Exhibición bloqueada",
  PRECIO_INCORRECTO: "Precio incorrecto",
  ENTREGA_INCOMPLETA: "Entrega incompleta",
  PDV_CERRADO: "PDV cerrado",
  RECHAZO_CLIENTE: "Rechazo del cliente",
  COMPETENCIA_INVASIVA: "Competencia invasiva",
  OTRO: "Otro",
};

function labelCategoria(value: string) {
  return CATEGORIA_LABEL[value] || value.replace(/_/g, " ");
}

function Kpi({ label, value, sub, danger = false }: { label: string; value: string | number; sub: string; danger?: boolean }) {
  return (
    <div className={`rounded-md border p-4 shadow-soft ${danger ? "border-red-100 bg-red-50" : "border-blue-100 bg-white"}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${danger ? "text-venado" : "text-skyroute"}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
    </div>
  );
}

export function DashboardCalidadPage() {
  const [fecha, setFecha] = useGlobalFecha();
  const [data, setData] = useState<IncidenciasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<IncidenciasData>("/dashboard/incidencias", { params: fecha ? { fecha } : {} })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [fecha]);

  const paretoCategoria = useMemo(() => {
    const rows = (data?.por_categoria || []).slice(0, 8);
    const total = rows.reduce((sum, row) => sum + row.total, 0) || 1;
    let acumulado = 0;
    return rows.map((row) => {
      acumulado += row.total;
      return { ...row, nombre: labelCategoria(row.nombre), acumulado: Math.round((acumulado / total) * 100) };
    });
  }, [data]);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const response = await api.get("/reportes/exportar-incidencias-excel", {
        params: { fecha_desde: fecha || undefined, fecha_hasta: fecha || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `venado_incidencias_${fecha || "calidad"}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel de calidad generado");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const incidencias = data?.incidencias || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-bold text-ink">Calidad e incidencias de campo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reportes hechos por reponedores: defectos, faltantes, entrega incompleta, PDV cerrado y problemas de exhibición.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-soft">
            <CalendarDays className="text-venado" size={20} />
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="h-8 rounded-md border-none px-2 text-sm focus:ring-0"
            />
          </label>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={downloading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-venado px-4 text-sm font-bold text-white hover:bg-skyroute disabled:opacity-50"
          >
            <FileSpreadsheet size={18} />
            {downloading ? "Generando..." : "Excel con Pareto"}
          </button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Kpi label="Reportes" value={data?.total || 0} sub="incidencias registradas" />
        <Kpi label="Abiertas" value={data?.abiertas || 0} sub="requieren seguimiento" danger={(data?.abiertas || 0) > 0} />
        <Kpi label="Criticas" value={data?.criticas || 0} sub="severidad alta" danger={(data?.criticas || 0) > 0} />
        <Kpi label="Afectan entrega" value={data?.afectan_entrega || 0} sub="impactan reposición" danger={(data?.afectan_entrega || 0) > 0} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-black text-ink">
                <ShieldAlert size={18} className="text-venado" />
                Pareto de defectos
              </h3>
              <p className="text-xs text-slate-500">Prioriza las categorías que generan mayor impacto operativo.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paretoCategoria} margin={{ top: 8, right: 16, left: -20, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nombre" angle={-30} textAnchor="end" interval={0} height={78} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Reportes" radius={[4, 4, 0, 0]}>
                {paretoCategoria.map((_, index) => (
                  <Cell key={index} fill={index < 3 ? "#c8102e" : "#174ea6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 font-black text-ink">
            <AlertTriangle size={18} className="text-skyroute" />
            Severidad
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.por_severidad || []}
                dataKey="total"
                nameKey="nombre"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={96}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {(data?.por_severidad || []).map((row) => (
                  <Cell key={row.nombre} fill={row.nombre === "ALTA" ? "#c8102e" : row.nombre === "MEDIA" ? "#174ea6" : "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 font-black text-ink">Mercados con más reportes</h3>
          <div className="space-y-2">
            {(data?.por_mercado || []).slice(0, 8).map((row, index) => (
              <div key={row.nombre} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-sm font-bold text-slate-700">
                  {index + 1}. {row.nombre}
                </span>
                <span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-venado">{row.total}</span>
              </div>
            ))}
            {!data?.por_mercado?.length ? <p className="text-sm text-slate-500">Sin reportes para la fecha.</p> : null}
          </div>
        </article>

        <article className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-100 p-4">
            <h3 className="font-black text-ink">Últimos reportes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">PDV</th>
                  <th className="px-4 py-3">Mercado</th>
                  <th className="px-4 py-3">Defecto</th>
                  <th className="px-4 py-3">Severidad</th>
                  <th className="px-4 py-3">Reponedor</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.slice(0, 12).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{row.pdv_codigo}</td>
                    <td className="px-4 py-3">{row.mercado}</td>
                    <td className="px-4 py-3">{labelCategoria(row.categoria)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-bold ${row.severidad === "ALTA" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {row.severidad}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.reponedor}</td>
                  </tr>
                ))}
                {!incidencias.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Todavía no hay reportes de calidad para esta fecha.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 text-skyroute" size={18} />
          <p>
            El botón de Excel genera un archivo con hoja de dashboard, detalle de incidencias, Pareto por categoría,
            Pareto por mercado y severidad. Es el insumo para análisis Lean Six Sigma sin depender de Power BI.
          </p>
        </div>
      </section>
    </div>
  );
}
