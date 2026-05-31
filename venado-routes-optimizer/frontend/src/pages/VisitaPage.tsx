import {
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  Play,
  RotateCcw,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api/client";
import { BadgeTipo } from "../components/BadgeTipo";
import { ChecklistMicroTareas } from "../components/ChecklistMicroTareas";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGeolocation } from "../hooks/useGeolocation";
import { FeatureCollection, Visita } from "../types";

const DEPOT = { latitud: -16.5, longitud: -68.1193 };

function distanceMeters(a: { latitud: number; longitud: number }, b: { latitud: number; longitud: number }) {
  const r = 6371000;
  const dLat = ((b.latitud - a.latitud) * Math.PI) / 180;
  const dLng = ((b.longitud - a.longitud) * Math.PI) / 180;
  const lat1 = (a.latitud * Math.PI) / 180;
  const lat2 = (b.latitud * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatMmSs(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface NavRouteData {
  coords: [number, number][];
  distancia_km: number | null;
  duracion_min: number | null;
  ors: boolean;
  fuente?: string;
}

interface GeometryResponse {
  geometry: { coordinates: [number, number][] };
  distancia_km: number | null;
  duracion_min: number | null;
  ors_geometry: boolean;
  fuente?: string;
}

export function VisitaPage() {
  const { visitaId } = useParams();
  const navigate = useNavigate();
  const { coords, setCoords, error, loading, request } = useGeolocation();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [allTasksDone, setAllTasksDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [travelStartedAt, setTravelStartedAt] = useState<number | null>(null);
  const [travelElapsed, setTravelElapsed] = useState(0);
  const [simulatedTravelMin, setSimulatedTravelMin] = useState<number | null>(null);
  const [travelOrigin, setTravelOrigin] = useState<{ latitud: number; longitud: number } | null>(null);
  const [navRoute, setNavRoute] = useState<NavRouteData | null>(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNavFetch = useRef("");

  async function load() {
    const { data } = await api.get<Visita>(`/visitas/${visitaId}`);
    setVisita(data);
  }

  useEffect(() => {
    load();
  }, [visitaId]);

  useEffect(() => {
    if (visita?.estado === "EN_TRASLADO" && visita.hora_inicio_traslado) {
      setTravelStartedAt(Date.parse(visita.hora_inicio_traslado));
      setTravelOrigin(null);
    }
  }, [visita?.estado, visita?.hora_inicio_traslado]);

  useEffect(() => {
    if (travelStartedAt === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTravelElapsed(Math.floor((Date.now() - travelStartedAt) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [travelStartedAt]);

  const meters = useMemo(() => {
    if (!coords || !visita) return null;
    return distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud });
  }, [coords, visita]);

  useEffect(() => {
    if (!coords || !visita) return;
    const distKm = distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud }) / 1000;
    if (distKm < 0.03) return;

    const key = `${visita.id}-${coords.latitud.toFixed(4)},${coords.longitud.toFixed(4)}-${visita.pdv.latitud.toFixed(4)},${visita.pdv.longitud.toFixed(4)}`;
    if (key === lastNavFetch.current) return;
    lastNavFetch.current = key;
    setLoadingNav(true);
    api
      .get<GeometryResponse>("/rutas/geometria-punto-a-punto", {
        params: {
          olat: coords.latitud,
          olng: coords.longitud,
          dlat: visita.pdv.latitud,
          dlng: visita.pdv.longitud,
        },
      })
      .then(({ data }) => {
        setNavRoute({
          coords: data.geometry.coordinates,
          distancia_km: data.distancia_km,
          duracion_min: data.duracion_min,
          ors: data.ors_geometry,
          fuente: data.fuente,
        });
      })
      .catch(() => setNavRoute(null))
      .finally(() => setLoadingNav(false));
  }, [coords, visita]);

  const visitInProgress = visita?.estado === "EN_PROGRESO";
  const isTraveling = visita?.estado === "EN_TRASLADO";
  const visitDone = visita?.estado === "COMPLETADA";
  const canStartVisit = Boolean(
    coords &&
      visita &&
      (visita.estado === "PENDIENTE" || visita.estado === "EN_TRASLADO") &&
      meters !== null &&
      meters <= 200 &&
      !saving,
  );

  const mapData: FeatureCollection | null = visita
    ? {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [visita.pdv.longitud, visita.pdv.latitud] },
            properties: {
              id: visita.pdv.id,
              codigo: visita.pdv.codigo,
              mercado: visita.pdv.mercado,
              tipo_cliente: visita.pdv.tipo_cliente,
            },
          },
        ],
      }
    : null;

  async function startTravelTimer() {
    if (!coords) {
      toast.error("Primero toca Ubicar para iniciar el viaje.");
      return;
    }
    if (travelStartedAt !== null) return;
    setSimulatedTravelMin(null);
    setTravelOrigin(coords);
    setSaving(true);
    try {
      const { data } = await api.post<{ hora_inicio_traslado: string }>(`/visitas/${visitaId}/iniciar-traslado`, {
        latitud: coords.latitud,
        longitud: coords.longitud,
      });
      setTravelStartedAt(Date.parse(data.hora_inicio_traslado));
      setTravelElapsed(0);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function simular() {
    if (!visita) return;
    const origin = coords ?? DEPOT;
    setTravelOrigin(origin);
    setSimulatedTravelMin(null);
    setTravelStartedAt(null);
    try {
      const { data } = await api.get<GeometryResponse>("/rutas/geometria-punto-a-punto", {
        params: {
          olat: origin.latitud,
          olng: origin.longitud,
          dlat: visita.pdv.latitud,
          dlng: visita.pdv.longitud,
        },
      });
      setNavRoute({
        coords: data.geometry.coordinates,
        distancia_km: data.distancia_km,
        duracion_min: data.duracion_min,
        ors: data.ors_geometry,
        fuente: data.fuente,
      });
      setSimulatedTravelMin(data.duracion_min ?? visita.tiempo_traslado_desde_anterior_min ?? 1);
    } catch {
      setSimulatedTravelMin(visita.tiempo_traslado_desde_anterior_min ?? 1);
    }
    setCoords({ latitud: visita.pdv.latitud, longitud: visita.pdv.longitud });
    toast.info("Simulacion aplicada: ubicacion movida al PDV.");
  }

  async function iniciar() {
    if (!coords) return toast.error("Ubicacion requerida");
    setSaving(true);
    try {
      const travelMin =
        simulatedTravelMin !== null
          ? simulatedTravelMin
          : travelStartedAt !== null
            ? Math.max(1, Math.ceil(travelElapsed / 60))
            : null;

      await api.post(`/visitas/${visitaId}/iniciar`, {
        latitud: coords.latitud,
        longitud: coords.longitud,
        origen_latitud: travelOrigin?.latitud ?? null,
        origen_longitud: travelOrigin?.longitud ?? null,
        tiempo_traslado_real_min: travelMin,
        simular: simulatedTravelMin !== null,
      });
      toast.success("Visita iniciada");
      setTravelStartedAt(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function finalizar() {
    if (!coords) return toast.error("Ubicacion requerida");
    setSaving(true);
    try {
      await api.post(`/visitas/${visitaId}/finalizar`, {
        latitud: coords.latitud,
        longitud: coords.longitud,
      });
      toast.success("Visita finalizada");
      navigate("/app/ruta-hoy");
    } finally {
      setSaving(false);
    }
  }

  if (!visita) {
    return <div className="h-80 rounded-md bg-white shadow-soft" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-lg text-ink">{visita.pdv.codigo}</strong>
              <BadgeTipo tipo={visita.pdv.tipo_cliente} />
            </div>
            <h2 className="mt-2 text-xl font-bold text-ink">{visita.pdv.nombre}</h2>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <MapPin size={16} /> {visita.pdv.mercado}
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            {visita.pdv.tiempo_visita_estimado_min} min en PDV
          </span>
        </div>

        {navRoute && !visitInProgress && !visitDone ? (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Navigation size={16} className="shrink-0 text-blue-600" />
            <div>
              <span className="font-semibold">
                {navRoute.distancia_km != null ? `${navRoute.distancia_km.toFixed(1)} km` : "?"} ·{" "}
                {navRoute.duracion_min != null ? `${navRoute.duracion_min} min` : "?"} hasta el PDV
              </span>
              <span className="ml-1 text-xs text-blue-500">
                ({navRoute.ors ? "OpenRouteService" : "estimado local"})
              </span>
            </div>
            {loadingNav ? <span className="ml-auto text-xs text-blue-400">Calculando...</span> : null}
          </div>
        ) : null}
      </section>

      <MapaLaPaz
        pdvs={mapData}
        currentLocation={coords}
        navRoute={!visitInProgress && !visitDone ? (navRoute?.coords ?? null) : null}
        heightClass="h-[300px]"
        zoom={15}
      />

      {meters !== null && meters > 200 ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Te encuentras a {meters.toFixed(0)} metros del PDV. Acercate para iniciar.
        </div>
      ) : meters !== null ? (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
          Estas a {meters.toFixed(0)} m del PDV. Puedes iniciar la visita.
        </div>
      ) : null}
      {error ? <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">{error}</div> : null}

      {travelStartedAt !== null && !visitInProgress ? (
        <div className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
            <Timer size={18} className="text-blue-600" /> Tiempo de viaje
          </span>
          <span className="font-mono text-2xl font-bold text-blue-900">{formatMmSs(travelElapsed)}</span>
        </div>
      ) : null}

      {simulatedTravelMin !== null && !visitInProgress ? (
        <div className="flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <Clock size={18} /> Viaje simulado
          </span>
          <span className="font-mono text-2xl font-bold text-red-900">{simulatedTravelMin} min</span>
        </div>
      ) : null}

      {!visitInProgress && !visitDone ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={request}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 font-semibold text-slate-700 shadow-soft"
            >
              <LocateFixed size={18} /> {loading ? "Buscando" : "Ubicar"}
            </button>
            <button
              type="button"
              onClick={startTravelTimer}
            disabled={saving || isTraveling || travelStartedAt !== null || simulatedTravelMin !== null}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-skyroute px-3 font-semibold text-white shadow-soft disabled:opacity-40"
            >
              <Play size={18} /> Inicio viaje
            </button>
            <button
              type="button"
              onClick={simular}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 font-semibold text-slate-700 shadow-soft"
            >
              <RotateCcw size={18} /> Simular
            </button>
          </div>

          <button
            type="button"
            onClick={iniciar}
            disabled={!canStartVisit}
            className="touch-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-venado px-4 py-3 font-bold text-white disabled:opacity-40"
          >
            <Navigation size={19} />
            {simulatedTravelMin !== null
              ? `Iniciar visita (${simulatedTravelMin} min viaje)`
              : travelStartedAt !== null
                ? `Iniciar visita (${formatMmSs(travelElapsed)} viaje)`
                : "Iniciar visita"}
          </button>
        </>
      ) : null}

      {visitInProgress ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
          Visita en progreso. Completa todas las micro-tareas para finalizar.
        </div>
      ) : null}

      <ChecklistMicroTareas visitaId={visita.id} disabled={!visitInProgress} onProgress={setAllTasksDone} />

      <button
        type="button"
        onClick={finalizar}
        disabled={saving || !visitInProgress || !allTasksDone || visitDone}
        className="touch-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-skyroute px-4 py-3 font-bold text-white disabled:opacity-40"
      >
        <CheckCircle2 size={20} /> Finalizar visita
      </button>
    </div>
  );
}
