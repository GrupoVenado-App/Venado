import { GitBranch, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { Ruta } from "../types";

export function DashboardRutasPage() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [fecha, setFecha] = useGlobalFecha();

  useEffect(() => {
    const params = fecha ? { fecha } : {};
    api.get<Ruta[]>("/rutas", { params }).then(({ data }) => setRutas(data));
  }, [fecha]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">Rutas</h2>
          <p className="text-sm text-slate-500">{rutas.length} rutas planificadas</p>
        </div>
        <div className="flex items-center gap-3">
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
        <Link
          to="/optimizador"
          className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-venado px-4 py-3 font-semibold text-white transition-colors hover:bg-skyroute"
        >
          <GitBranch size={18} />
          Optimizar rutas
        </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Reponedor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">PDVs</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Min</th>
              </tr>
            </thead>
            <tbody>
              {rutas.map((ruta) => (
                <tr key={ruta.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{ruta.fecha}</td>
                  <td className="px-4 py-3">{ruta.reponedor?.nombre}</td>
                  <td className="px-4 py-3">{ruta.estado}</td>
                  <td className="px-4 py-3">{ruta.visitas.length}</td>
                  <td className="px-4 py-3">{ruta.distancia_total_km.toFixed(1)}</td>
                  <td className="px-4 py-3">{ruta.tiempo_total_estimado_min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
