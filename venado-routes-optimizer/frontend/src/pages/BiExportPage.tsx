import { Calendar, Download, FileSpreadsheet, ListChecks, Route, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../api/client";

type TablaBI = "visitas" | "micro_tareas" | "rutas";

const EXPORTS: Array<{
  tabla: TablaBI;
  title: string;
  description: string;
  icon: React.ElementType;
  filename: string;
  accent: string;
}> = [
  {
    tabla: "visitas",
    title: "Visitas por PDV",
    description: "Tiempos, distancias, coordenadas, desvios y evidencias por cada visita.",
    icon: FileSpreadsheet,
    filename: "venado_visitas_pdv.csv",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    tabla: "micro_tareas",
    title: "Micro-tareas",
    description: "Detalle de cada tarea ejecutada: marca, estado, tiempo real y foto.",
    icon: ListChecks,
    filename: "venado_micro_tareas.csv",
    accent: "border-red-200 bg-red-50 text-red-700",
  },
  {
    tabla: "rutas",
    title: "Rutas diarias",
    description: "Resumen por reponedor: cobertura, carga de trabajo, kilometros y tiempos.",
    icon: Route,
    filename: "venado_rutas_diarias.csv",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
];

export function BiExportPage() {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState<TablaBI | null>(null);
  const [loadingExcel, setLoadingExcel] = useState(false);

  async function download(tabla: TablaBI, filename: string) {
    setLoading(tabla);
    try {
      const response = await api.get("/reportes/exportar-bi", {
        params: { tabla, fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV generado");
    } finally {
      setLoading(null);
    }
  }

  async function downloadIncidenciasExcel() {
    setLoadingExcel(true);
    try {
      const response = await api.get("/reportes/exportar-incidencias-excel", {
        params: { fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "venado_incidencias_calidad.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel con Pareto generado");
    } finally {
      setLoadingExcel(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-2xl font-bold text-ink">BI Export</h2>
          <p className="mt-1 text-sm text-slate-500">
            Descargas limpias para Excel y Power BI.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative block">
            <Calendar className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              className="h-11 rounded-md border border-slate-300 pl-10 pr-3 text-sm"
              aria-label="Fecha desde"
            />
          </label>
          <label className="relative block">
            <Calendar className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              className="h-11 rounded-md border border-slate-300 pl-10 pr-3 text-sm"
              aria-label="Fecha hasta"
            />
          </label>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {EXPORTS.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.tabla} className={`rounded-lg border bg-white p-4 shadow-sm ${item.accent}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/80">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => download(item.tabla, item.filename)}
                disabled={loading !== null}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-venado px-4 text-sm font-semibold text-white transition-colors hover:bg-skyroute disabled:opacity-50"
              >
                <Download size={17} />
                {loading === item.tabla ? "Generando..." : "Descargar CSV"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white text-venado">
              <ShieldAlert size={22} />
            </span>
            <div>
              <h3 className="font-bold text-slate-900">Incidencias de calidad con Pareto</h3>
              <p className="mt-1 text-sm text-slate-600">
                Excel con dashboard, detalle de reportes, Pareto por defecto, Pareto por mercado y severidad.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadIncidenciasExcel}
            disabled={loadingExcel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-venado px-4 text-sm font-semibold text-white transition-colors hover:bg-skyroute disabled:opacity-50"
          >
            <FileSpreadsheet size={17} />
            {loadingExcel ? "Generando..." : "Descargar Excel"}
          </button>
        </div>
      </section>
    </div>
  );
}
