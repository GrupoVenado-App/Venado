import { Activity, CalendarDays, CheckCircle2, Clock, MapPinned, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { KpiCard } from "../components/KpiCard";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGlobalFecha } from "../hooks/useGlobalFecha";
import { DashboardResumen, FeatureCollection } from "../types";

export function DashboardMapPage() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [pdvs, setPdvs] = useState<FeatureCollection | null>(null);
  const [coverage, setCoverage] = useState<{ pdvs: FeatureCollection; rutas: FeatureCollection } | null>(null);
  const [todosLosMercados, setTodosLosMercados] = useState<string[]>([]);
  const [fecha, setFecha] = useGlobalFecha();
  const [tipo, setTipo] = useState("");
  const [mercado, setMercado] = useState("");

  async function load() {
    const params: Record<string, string> = {};
    if (fecha) params.fecha = fecha;
    if (tipo) params.tipo = tipo;
    if (mercado) params.mercado = mercado;
    
    // For dashboard APIs, we pass fecha
    const dashParams: Record<string, string> = {};
    if (fecha) dashParams.fecha = fecha;

    const [resumenResponse, pdvsResponse, coverageResponse] = await Promise.all([
      api.get<DashboardResumen>("/dashboard/resumen-hoy", { params: dashParams }),
      api.get<FeatureCollection>("/pdvs/mapa", { params }),
      api.get<{ pdvs: FeatureCollection; rutas: FeatureCollection }>("/dashboard/cobertura-mapa", { params: dashParams }),
    ]);
    setResumen(resumenResponse.data);
    setPdvs(pdvsResponse.data);
    setCoverage(coverageResponse.data);
  }

  useEffect(() => {
    load();
  }, [fecha, tipo, mercado]);

  useEffect(() => {
    if (pdvs?.features && !tipo && !mercado && todosLosMercados.length === 0) {
      const list = Array.from(new Set(pdvs.features.map((feature) => String(feature.properties.mercado || ""))))
        .filter(Boolean)
        .sort();
      setTodosLosMercados(list);
    }
  }, [pdvs, tipo, mercado, todosLosMercados]);

  const filteredPdvs = useMemo(() => {
    const basePdvs = coverage?.pdvs?.features.length ? coverage.pdvs : pdvs;
    if (!basePdvs) return null;

    return {
      ...basePdvs,
      features: basePdvs.features.filter((feature) => {
        const matchTipo = tipo ? feature.properties.tipo_cliente === tipo : true;
        const matchMercado = mercado ? String(feature.properties.mercado).toUpperCase() === mercado.toUpperCase() : true;
        return matchTipo && matchMercado;
      }),
    };
  }, [coverage, pdvs, tipo, mercado]);

  const filteredRutas = useMemo(() => {
    if (!coverage?.rutas) return null;
    if (!tipo && !mercado) return coverage.rutas;

    const visibleCoords = new Set(
      filteredPdvs?.features
        .map((f) => {
          if (f.geometry.type === "Point") {
            const [lng, lat] = f.geometry.coordinates as [number, number];
            return `${lng.toFixed(6)},${lat.toFixed(6)}`;
          }
          return "";
        })
        .filter(Boolean) || []
    );

    const features = coverage.rutas.features
      .map((route) => {
        if (route.geometry.type !== "LineString") return route;
        const coords = route.geometry.coordinates as Array<[number, number]>;
        const filteredCoords = coords.filter(([lng, lat]) =>
          visibleCoords.has(`${lng.toFixed(6)},${lat.toFixed(6)}`)
        );
        return {
          ...route,
          geometry: {
            ...route.geometry,
            coordinates: filteredCoords,
          },
        };
      })
      .filter((route) => route.geometry.coordinates.length >= 2);

    return {
      ...coverage.rutas,
      features,
    };
  }, [coverage, filteredPdvs, tipo, mercado]);

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
          <input 
            type="date" 
            value={fecha} 
            onChange={(event) => setFecha(event.target.value)} 
            className="h-11 rounded-md border border-slate-300 px-3"
            title="Fecha global"
          />
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3">
            <option value="">Todos los tipos</option>
            <option value="PARETO">PARETO</option>
            <option value="MAYORISTA">MAYORISTA</option>
            <option value="MINORISTA">MINORISTA</option>
            <option value="DETALLISTA">DETALLISTA</option>
          </select>
          <select value={mercado} onChange={(event) => setMercado(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3">
            <option value="">Todos los mercados</option>
            {todosLosMercados.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <MapaLaPaz pdvs={filteredPdvs} rutas={filteredRutas} />
    </div>
  );
}
