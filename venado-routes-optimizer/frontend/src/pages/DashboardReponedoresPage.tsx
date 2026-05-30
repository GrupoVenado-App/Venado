import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { CalendarDays } from "lucide-react";

interface Row {
  reponedor: string;
  supervisor: string;
  pdvs_visitados: number;
  pdvs_planificados: number;
  tiempo_total: number;
  distancia_total: number;
  eficiencia: number;
}

export function DashboardReponedoresPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fecha, setFecha] = useGlobalFecha();

  useEffect(() => {
    const params = fecha ? { fecha } : {};
    api.get<Row[]>("/dashboard/metricas-por-reponedor", { params }).then(({ data }) => setRows(data));
  }, [fecha]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-ink">Reponedores</h2>
        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-md shadow-soft border border-slate-200">
          <CalendarDays className="text-venado" size={20} />
          <input 
            type="date" 
            value={fecha} 
            onChange={(event) => setFecha(event.target.value)} 
            className="h-8 rounded-md border-none px-2 focus:ring-0 text-sm"
            title="Fecha global"
          />
        </div>
      </div>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Visitados</th>
                <th className="px-4 py-3">Planificados</th>
                <th className="px-4 py-3">Tiempo</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Eficiencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.reponedor} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{row.reponedor}</td>
                  <td className="px-4 py-3">{row.supervisor}</td>
                  <td className="px-4 py-3">{row.pdvs_visitados}</td>
                  <td className="px-4 py-3">{row.pdvs_planificados}</td>
                  <td className="px-4 py-3">{row.tiempo_total} min</td>
                  <td className="px-4 py-3">{row.distancia_total.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-1 font-semibold">{row.eficiencia}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
