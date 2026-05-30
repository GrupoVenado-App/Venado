import { Activity, CheckCircle2, Clock, MapPinned, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { KpiCard } from "../components/KpiCard";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { DashboardResumen, FeatureCollection } from "../types";

export function DashboardMapPage() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [pdvs, setPdvs] = useState<FeatureCollection | null>(null);
  const [coverage, setCoverage] = useState<{ pdvs: FeatureCollection; rutas: FeatureCollection } | null>(null);
  const [tipo, setTipo] = useState("");
  const [mercado, setMercado] = useState("");

  async function load() {
    const params: Record<string, string> = {};
    if (tipo) params.tipo = tipo;
    if (mercado) params.mercado = mercado;
    const [resumenResponse, pdvsResponse, coverageResponse] = await Promise.all([
      api.get<DashboardResumen>("/dashboard/resumen-hoy"),
      api.get<FeatureCollection>("/pdvs/mapa", { params }),
      api.get<{ pdvs: FeatureCollection; rutas: FeatureCollection }>("/dashboard/cobertura-mapa"),
    ]);
    setResumen(resumenResponse.data);
    setPdvs(pdvsResponse.data);
    setCoverage(coverageResponse.data);
  }

  useEffect(() => {
    load();
  }, [tipo, mercado]);

  const mercados = useMemo(
    () => Array.from(new Set(pdvs?.features.map((feature) => String(feature.properties.mercado)) || [])).sort(),
    [pdvs],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="PDVs planificados" value={resumen?.total_pdvs_planificados ?? 0} icon={MapPinned} />
        <KpiCard title="Completadas" value={resumen?.total_visitas_completadas ?? 0} icon={CheckCircle2} />
        <KpiCard title="En progreso" value={resumen?.total_en_progreso ?? 0} icon={Activity} />
        <KpiCard title="Reponedores" value={resumen?.total_reponedores_activos ?? 0} icon={Users} />
        <KpiCard title="Cobertura" value={`${resumen?.cobertura_porcentaje ?? 0}%`} icon={Clock} />
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3">
            <option value="">Todos los tipos</option>
            <option value="PARETO">PARETO</option>
            <option value="MAYORISTA">MAYORISTA</option>
            <option value="MINORISTA">MINORISTA</option>
            <option value="DETALLISTA">DETALLISTA</option>
          </select>
          <select value={mercado} onChange={(event) => setMercado(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3">
            <option value="">Todos los mercados</option>
            {mercados.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <MapaLaPaz pdvs={coverage?.pdvs?.features.length ? coverage.pdvs : pdvs} rutas={coverage?.rutas} />
    </div>
  );
}
