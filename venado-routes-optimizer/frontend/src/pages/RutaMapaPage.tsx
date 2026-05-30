import { CalendarDays, Clock, ListChecks, MapPinned } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { FeatureCollection, Ruta } from "../types";

export function RutaMapaPage() {
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

  const visitas = rutas.flatMap((ruta) => ruta.visitas).sort((a, b) => a.orden_planificado - b.orden_planificado);

  const mapData = useMemo(() => {
    const pdvs: FeatureCollection = {
      type: "FeatureCollection",
      features: visitas.map((visita) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [visita.pdv.longitud, visita.pdv.latitud] },
        properties: {
          id: visita.pdv.id,
          visita_id: visita.id,
          codigo: visita.pdv.codigo,
          mercado: visita.pdv.mercado,
          tipo_cliente: visita.pdv.tipo_cliente,
          estado: visita.estado,
        },
      })),
    };

    const rutasGeo: FeatureCollection = {
      type: "FeatureCollection",
      features: rutas.map((ruta) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [...ruta.visitas]
            .sort((a, b) => a.orden_planificado - b.orden_planificado)
            .map((visita) => [visita.pdv.longitud, visita.pdv.latitud] as [number, number]),
        },
        properties: { ruta_id: ruta.id, reponedor: ruta.reponedor?.nombre || "" },
      })),
    };

    return { pdvs, rutas: rutasGeo };
  }, [rutas, visitas]);

  const totals = {
    km: rutas.reduce((sum, ruta) => sum + ruta.distancia_total_km, 0),
    min: rutas.reduce((sum, ruta) => sum + ruta.tiempo_total_estimado_min, 0),
  };

  if (loading) {
    return <div className="h-80 rounded-md bg-white shadow-soft" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">
              Ruta del {fecha ? new Date(fecha).toLocaleDateString() : "Día"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-ink">{visitas.length} PDVs ordenados</h2>
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
        <>
          <MapaLaPaz pdvs={mapData.pdvs} rutas={mapData.rutas} heightClass="h-[420px]" zoom={13} />
          <section className="rounded-md border border-slate-200 bg-white p-3 shadow-soft">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
              <ListChecks size={17} /> Secuencia
            </div>
            <div className="space-y-2">
              {visitas.map((visita) => (
                <Link
                  key={visita.id}
                  to={`/app/visita/${visita.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-slate-50 px-3 text-sm"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {visita.orden_planificado}. {visita.pdv.codigo} · {visita.pdv.mercado}
                  </span>
                  <span className="shrink-0 text-slate-500">{visita.pdv.tiempo_visita_estimado_min} min</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No tienes ruta planificada para esta fecha.
        </section>
      )}
    </div>
  );
}
