import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Row {
  visita_id: string;
  fecha: string;
  reponedor: string;
  pdv: string;
  mercado: string;
  tipo: string;
  estimado: number;
  real: number;
  factor: number;
}

export function DashboardDesviacionesPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api.get<Row[]>("/dashboard/desviaciones").then(({ data }) => setRows(data));
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-ink">Desviaciones</h2>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">PDV</th>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Reponedor</th>
                <th className="px-4 py-3">Estimado</th>
                <th className="px-4 py-3">Real</th>
                <th className="px-4 py-3">Factor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.visita_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{row.fecha}</td>
                  <td className="px-4 py-3 font-semibold">{row.pdv}</td>
                  <td className="px-4 py-3">{row.mercado}</td>
                  <td className="px-4 py-3">{row.reponedor}</td>
                  <td className="px-4 py-3">{row.estimado} min</td>
                  <td className="px-4 py-3">{row.real} min</td>
                  <td className="px-4 py-3 text-venado">{row.factor}x</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                    Sin desviaciones registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
