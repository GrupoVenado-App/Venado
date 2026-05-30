import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { CalendarDays } from "lucide-react";

interface MercadoRow {
  mercado: string;
  pdvs_totales: number;
  pdvs_planificados_hoy: number;
  visitas_completadas: number;
  cobertura: number;
}

export function DashboardMercadosPage() {
  const [rows, setRows] = useState<MercadoRow[]>([]);
  const [fecha, setFecha] = useGlobalFecha();

  useEffect(() => {
    const params = fecha ? { fecha } : {};
    api.get<MercadoRow[]>("/dashboard/por-mercado", { params }).then(({ data }) => setRows(data));
  }, [fecha]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-ink">Mercados</h2>
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
      <section className="h-[360px] rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.slice(0, 18)} margin={{ top: 8, right: 16, left: 0, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mercado" angle={-35} textAnchor="end" interval={0} height={90} tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="pdvs_totales" stackId="a" fill="#2563eb" name="PDVs" />
            <Bar dataKey="visitas_completadas" stackId="a" fill="#15803d" name="Completadas" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">PDVs</th>
                <th className="px-4 py-3">Planificados</th>
                <th className="px-4 py-3">Completados</th>
                <th className="px-4 py-3">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mercado} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{row.mercado}</td>
                  <td className="px-4 py-3">{row.pdvs_totales}</td>
                  <td className="px-4 py-3">{row.pdvs_planificados_hoy}</td>
                  <td className="px-4 py-3">{row.visitas_completadas}</td>
                  <td className="px-4 py-3">{row.cobertura}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
