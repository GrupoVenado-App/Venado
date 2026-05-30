import { CalendarDays, Clock, MapPinned } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { TarjetaPDV } from "../components/TarjetaPDV";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { Ruta } from "../types";

export function RutaHoyPage() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useGlobalFecha();

  useEffect(() => {
    const params = fecha ? { fecha } : {};
    setLoading(true);
    api
      .get<Ruta[]>("/rutas/mis-rutas", { params })
      .then(({ data }) => setRutas(data))
      .finally(() => setLoading(false));
  }, [fecha]);

  const visitas = rutas.flatMap((ruta) => ruta.visitas);
  const totals = useMemo(
    () => ({
      visitas: visitas.length,
      km: rutas.reduce((sum, ruta) => sum + ruta.distancia_total_km, 0),
      min: rutas.reduce((sum, ruta) => sum + ruta.tiempo_total_estimado_min, 0),
    }),
    [rutas, visitas.length],
  );

  if (loading) {
    return <div className="h-40 rounded-md bg-white shadow-soft" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">
              Ruta del {fecha ? new Date(fecha).toLocaleDateString() : "Día"}
            </p>
            <h2 className="text-2xl font-bold text-ink">{totals.visitas} PDVs</h2>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={fecha} 
              onChange={(event) => setFecha(event.target.value)} 
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              title="Seleccionar otra fecha"
            />
            <CalendarDays className="text-venado hidden sm:block" size={28} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2">
            <MapPinned size={16} /> {totals.km.toFixed(1)} km
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2">
            <Clock size={16} /> {totals.min} min
          </span>
        </div>
      </section>

      {visitas.length ? (
        visitas.map((visita) => <TarjetaPDV key={visita.id} visita={visita} />)
      ) : (
        <section className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No tienes ruta planificada para hoy.
        </section>
      )}
    </div>
  );
}
