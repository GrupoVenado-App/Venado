import { Calendar, Check, Search, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../api/client";
import { BadgeTipo } from "../components/BadgeTipo";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { FeatureCollection, PDV, Reponedor, Ruta } from "../types";

interface OptimizerResponse {
  fecha: string;
  criterio: string;
  rutas: Ruta[];
  resumen: {
    rutas_creadas: number;
    pdvs_asignados: number;
    km_totales: number;
    tiempo_total_min: number;
  };
}

function tomorrow() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function OptimizadorPage() {
  const [pdvs, setPdvs] = useState<PDV[]>([]);
  const [reponedores, setReponedores] = useState<Reponedor[]>([]);
  const [selectedPdvs, setSelectedPdvs] = useState<string[]>([]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [fecha, setFecha] = useState(tomorrow());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizerResponse | null>(null);

  useEffect(() => {
    Promise.all([api.get<PDV[]>("/pdvs", { params: { limit: 1000 } }), api.get<Reponedor[]>("/reponedores")]).then(
      ([pdvResponse, repResponse]) => {
        setPdvs(pdvResponse.data);
        setReponedores(repResponse.data);
        setSelectedPdvs(pdvResponse.data.slice(0, 30).map((pdv) => pdv.id));
        setSelectedReps(repResponse.data.slice(0, 4).map((rep) => rep.id));
      },
    );
  }, []);

  const filteredPdvs = useMemo(() => {
    const term = query.trim().toUpperCase();
    if (!term) return pdvs.slice(0, 140);
    return pdvs
      .filter((pdv) => `${pdv.codigo} ${pdv.mercado} ${pdv.tipo_cliente} ${pdv.reponedor_asignado}`.includes(term))
      .slice(0, 140);
  }, [pdvs, query]);

  const resultMap = useMemo(() => {
    if (!result) return null;
    const pointFeatures = result.rutas.flatMap((ruta) =>
      ruta.visitas.map((visita) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [visita.pdv.longitud, visita.pdv.latitud] as [number, number] },
        properties: {
          id: visita.pdv.id,
          codigo: visita.pdv.codigo,
          mercado: visita.pdv.mercado,
          tipo_cliente: visita.pdv.tipo_cliente,
          reponedor: ruta.reponedor?.nombre || "",
        },
      })),
    );
    const routeFeatures = result.rutas.map((ruta) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: ruta.visitas.map((visita) => [visita.pdv.longitud, visita.pdv.latitud] as [number, number]),
      },
      properties: { ruta_id: ruta.id, reponedor: ruta.reponedor?.nombre || "" },
    }));
    return {
      pdvs: { type: "FeatureCollection", features: pointFeatures } as FeatureCollection,
      rutas: { type: "FeatureCollection", features: routeFeatures } as FeatureCollection,
    };
  }, [result]);

  function toggle(list: string[], setter: (value: string[]) => void, id: string) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function optimize() {
    if (!selectedPdvs.length || !selectedReps.length) {
      toast.error("Selecciona PDVs y reponedores");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<OptimizerResponse>("/rutas/optimizar", {
        fecha,
        pdv_ids: selectedPdvs,
        reponedor_ids: selectedReps,
        criterio: "MINIMIZAR_TIEMPO_TOTAL",
      });
      setResult(data);
      toast.success(`${data.resumen.rutas_creadas} rutas creadas`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">Optimizador</h2>
          <p className="text-sm text-slate-500">{selectedPdvs.length} PDVs · {selectedReps.length} reponedores</p>
        </div>
        <button
          type="button"
          onClick={optimize}
          disabled={loading}
          className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-venado px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          <Zap size={18} />
          {loading ? "Calculando..." : "Calcular rutas optimas"}
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <label className="relative block">
              <Calendar className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3"
              />
            </label>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar PDV, mercado, tipo o reponedor"
                className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3"
              />
            </label>
          </div>
          <div className="mt-4 h-[360px] overflow-y-auto rounded-md border border-slate-200">
            {filteredPdvs.map((pdv) => (
              <label key={pdv.id} className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedPdvs.includes(pdv.id)}
                  onChange={() => toggle(selectedPdvs, setSelectedPdvs, pdv.id)}
                  className="h-5 w-5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{pdv.codigo} · {pdv.mercado}</span>
                  <span className="text-sm text-slate-500">{pdv.tiempo_visita_estimado_min} min · {pdv.reponedor_asignado}</span>
                </span>
                <BadgeTipo tipo={pdv.tipo_cliente} />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Reponedores</h3>
            <button
              type="button"
              onClick={() => setSelectedReps(reponedores.map((rep) => rep.id))}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700"
            >
              <Check size={16} />
              Todos
            </button>
          </div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
            {reponedores.map((rep) => (
              <label key={rep.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md bg-slate-50 px-3">
                <input
                  type="checkbox"
                  checked={selectedReps.includes(rep.id)}
                  onChange={() => toggle(selectedReps, setSelectedReps, rep.id)}
                  className="h-5 w-5"
                />
                <span>
                  <span className="block font-semibold text-ink">{rep.nombre}</span>
                  <span className="text-xs text-slate-500">{rep.supervisor}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {result ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm text-slate-500">Rutas</p>
              <strong className="mt-1 block text-2xl">{result.resumen.rutas_creadas}</strong>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm text-slate-500">PDVs</p>
              <strong className="mt-1 block text-2xl">{result.resumen.pdvs_asignados}</strong>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm text-slate-500">Km</p>
              <strong className="mt-1 block text-2xl">{result.resumen.km_totales.toFixed(1)}</strong>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm text-slate-500">Tiempo</p>
              <strong className="mt-1 block text-2xl">{result.resumen.tiempo_total_min} min</strong>
            </div>
          </div>
          <MapaLaPaz pdvs={resultMap?.pdvs} rutas={resultMap?.rutas} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {result.rutas.map((ruta) => (
              <article key={ruta.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
                <h3 className="font-bold text-ink">{ruta.reponedor?.nombre}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {ruta.visitas.length} PDVs · {ruta.distancia_total_km.toFixed(1)} km · {ruta.tiempo_total_estimado_min} min
                </p>
                <ol className="mt-3 space-y-2 text-sm">
                  {ruta.visitas.slice(0, 8).map((visita) => (
                    <li key={visita.id} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-2">
                      <span className="truncate">{visita.orden_planificado}. {visita.pdv.codigo}</span>
                      <span className="text-slate-500">{visita.pdv.mercado}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
