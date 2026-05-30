import { useEffect, useState } from "react";
import { api } from "../api/client";

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

  useEffect(() => {
    api.get<Row[]>("/dashboard/metricas-por-reponedor").then(({ data }) => setRows(data));
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-ink">Reponedores</h2>
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
