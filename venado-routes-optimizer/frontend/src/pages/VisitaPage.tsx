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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api/client";
import { BadgeTipo } from "../components/BadgeTipo";
import { ChecklistMicroTareas } from "../components/ChecklistMicroTareas";
import { MapaLaPaz } from "../components/MapaLaPaz";
import { useGeolocation } from "../hooks/useGeolocation";
import { FeatureCollection, Visita } from "../types";

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
  coords: [number, number][];  // [lng, lat]
  distancia_km: number | null;
  duracion_min: number | null;
  ors: boolean;
}

export function VisitaPage() {
  const { visitaId } = useParams();
  const navigate = useNavigate();
  const { coords, setCoords, error, loading, request } = useGeolocation();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [allTasksDone, setAllTasksDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Travel chronometer ────────────────────────────────────────────────────
  const [travelStartedAt, setTravelStartedAt] = useState<number | null>(null); // unix ms
  const [travelElapsed, setTravelElapsed] = useState(0); // seconds
  const [simulatedTravelMin, setSimulatedTravelMin] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── ORS navigation route (current pos → PDV) ─────────────────────────────
  const [navRoute, setNavRoute] = useState<NavRouteData | null>(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const lastNavFetch = useRef<string>("");

  async function load() {
    const { data } = await api.get<Visita>(`/visitas/${visitaId}`);
    setVisita(data);
  }

  useEffect(() => {
    load();
  }, [visitaId]);

  // ── Start travel chronometer ──────────────────────────────────────────────
  function startTravelTimer() {
    if (travelStartedAt !== null) return;
    setSimulatedTravelMin(null);
    setTravelStartedAt(Date.now());
    setTravelElapsed(0);
  }

  useEffect(() => {
    if (travelStartedAt === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTravelElapsed(Math.floor((Date.now() - travelStartedAt) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [travelStartedAt]);

  // ── Fetch ORS navigation route when coords change ─────────────────────────
  // Only fetch if within 50 km of the PDV (avoids absurd results when GPS is far away)
  const MAX_NAV_KM = 50;
  useEffect(() => {
    if (!coords || !visita) return;
    const distKm = distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud }) / 1000;
    if (distKm > MAX_NAV_KM) {
      // Too far away — don't call ORS, just clear nav route
      setNavRoute(null);
      setLoadingNav(false);
      return;
    }
    const key = `${coords.latitud.toFixed(4)},${coords.longitud.toFixed(4)}`;
    if (key === lastNavFetch.current) return;
    lastNavFetch.current = key;
    setLoadingNav(true);
    api
      .get<{ geometry: { coordinates: [number, number][] }; distancia_km: number; duracion_min: number; ors_geometry: boolean }>(
        "/rutas/geometria-punto-a-punto",
        {
          params: {
            olat: coords.latitud,
            olng: coords.longitud,
            dlat: visita.pdv.latitud,
            dlng: visita.pdv.longitud,
          },
        }
      )
      .then(({ data }) => {
        setNavRoute({
          coords: data.geometry.coordinates,
          distancia_km: data.distancia_km,
          duracion_min: data.duracion_min,
          ors: data.ors_geometry,
        });
      })
      .catch(() => setNavRoute(null))
      .finally(() => setLoadingNav(false));
  }, [coords, visita]);

  const meters = useMemo(() => {
    if (!coords || !visita) return null;
    return distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud });
  }, [coords, visita]);

  const canStartVisit = Boolean(
    coords && visita && visita.estado === "PENDIENTE" && meters !== null && meters <= 200 && !saving,
  );
  const visitInProgress = visita?.estado === "EN_PROGRESO";
  const visitDone = visita?.estado === "COMPLETADA";

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

  async function simular() {
    if (!visita) return;
    // Get ORS estimate from current real position (if available) or depot
    const origin = coords ?? { latitud: -16.5, longitud: -68.1193 };
    setSimulatedTravelMin(null);
    setTravelStartedAt(null);
    // Fetch ORS estimate for this leg
    try {
      const { data } = await api.get<{ duracion_min: number | null }>(
        "/rutas/geometria-punto-a-punto",
        {
          params: {
            olat: origin.latitud,
            olng: origin.longitud,
            dlat: visita.pdv.latitud,
            dlng: visita.pdv.longitud,
          },
        }
      );
      setSimulatedTravelMin(data.duracion_min ?? visita.pdv.tiempo_visita_estimado_min);
    } catch {
      setSimulatedTravelMin(visita.pdv.tiempo_visita_estimado_min);
    }
    setCoords({ latitud: visita.pdv.latitud, longitud: visita.pdv.longitud });
    toast.info("Simulación: te has teletransportado al PDV 🚀");
  }

  async function iniciar() {
    if (!coords) return toast.error("Ubicación requerida");
    setSaving(true);
    try {
      // Calculate travel time: from chronometer OR from simulation
      const travelMin =
        simulatedTravelMin !== null
          ? simulatedTravelMin
          : travelStartedAt !== null
          ? Math.max(1, Math.ceil(travelElapsed / 60))
          : null;

      await api.post(`/visitas/${visitaId}/iniciar`, {
        latitud: coords.latitud,
        longitud: coords.longitud,
        tiempo_traslado_real_min: travelMin,
        simular: simulatedTravelMin !== null,
      });
      toast.success("¡Visita iniciada!");
      setTravelStartedAt(null); // stop timer
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function finalizar() {
    if (!coords) return toast.error("Ubicación requerida");
    setSaving(true);
    try {
      await api.post(`/visitas/${visitaId}/finalizar`, {
        latitud: coords.latitud,
        longitud: coords.longitud,
      });
      toast.success("¡Visita finalizada!");
      navigate("/app/ruta-hoy");
    } finally {
      setSaving(false);
    }
  }

  if (!visita) {
    return <div className="h-80 rounded-md bg-white shadow-soft" />;
  }

  const travelMinsDisplay = simulatedTravelMin ?? (travelStartedAt !== null ? Math.ceil(travelElapsed / 60) : null);

  return (
    <div className="space-y-4">
      {/* PDV info card */}
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
          <div className="text-right">
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700" title="Tiempo estimado de permanencia en el PDV realizando micro-tareas">
              {visita.pdv.tiempo_visita_estimado_min} min en PDV
            </span>
          </div>
        </div>

        {/* ORS estimated route info — only shown when within 50 km */}
        {navRoute && !visitInProgress && !visitDone && (
          <div className="mt-3 flex items-center gap-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 border border-blue-200">
            <Navigation size={16} className="shrink-0 text-blue-600" />
            <div>
              <span className="font-semibold">
                {navRoute.distancia_km != null ? `${navRoute.distancia_km.toFixed(1)} km` : "?"} ·{" "}
                ~{navRoute.duracion_min != null ? `${navRoute.duracion_min} min` : "?"} de viaje hasta el PDV
              </span>
              {!navRoute.ors && <span className="ml-1 text-xs text-blue-500">(estimado local)</span>}
            </div>
            {loadingNav && <span className="ml-auto text-xs text-blue-400 animate-pulse">Calculando...</span>}
          </div>
        )}
        {coords && visita && distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud }) / 1000 > 50 && !visitInProgress && !visitDone && (
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            📍 GPS detectado lejos del área. Usa <strong>Simular</strong> para probar el flujo.
          </div>
        )}
      </section>

      {/* Map with nav route */}
      <MapaLaPaz
        pdvs={mapData}
        currentLocation={coords}
        navRoute={!visitInProgress && !visitDone ? (navRoute?.coords ?? null) : null}
        heightClass="h-[260px]"
        zoom={15}
      />

      {/* Distance warning */}
      {meters !== null && meters > 200 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Te encuentras a {meters.toFixed(0)} metros del PDV. Acércate para iniciar.
        </div>
      ) : meters !== null && meters <= 200 ? (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
          ✓ Estás a {meters.toFixed(0)} m del PDV — puedes iniciar la visita.
        </div>
      ) : null}
      {error ? <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">{error}</div> : null}

      {/* Chronometer display */}
      {travelStartedAt !== null && !visitInProgress && (
        <div className="flex items-center justify-between rounded-md border border-indigo-300 bg-indigo-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
            <Timer size={18} className="text-indigo-600" /> Tiempo de viaje
          </span>
          <span className="font-mono text-2xl font-bold text-indigo-900">{formatMmSs(travelElapsed)}</span>
        </div>
      )}
      {simulatedTravelMin !== null && !visitInProgress && (
        <div className="flex items-center justify-between rounded-md border border-purple-300 bg-purple-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-purple-800">
            <Clock size={18} /> Viaje simulado (ORS)
          </span>
          <span className="font-mono text-2xl font-bold text-purple-900">{simulatedTravelMin} min</span>
        </div>
      )}

      {/* Action buttons */}
      {!visitInProgress && !visitDone && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={request}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 font-semibold text-slate-700 shadow-soft"
            >
              <LocateFixed size={18} /> {loading ? "Buscando..." : "Ubicar"}
            </button>
            <button
              type="button"
              onClick={startTravelTimer}
              disabled={travelStartedAt !== null || simulatedTravelMin !== null}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 font-semibold text-white shadow-soft disabled:opacity-40"
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
            className="touch-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-40"
          >
            <Navigation size={19} />
            {simulatedTravelMin !== null
              ? `Iniciar visita (viaje simulado: ${simulatedTravelMin} min)`
              : travelStartedAt !== null
              ? `Iniciar visita (viaje: ${formatMmSs(travelElapsed)})`
              : "Iniciar visita"}
          </button>
        </>
      )}

      {visitInProgress && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
          Visita en progreso — completa todas las micro-tareas para finalizar.
        </div>
      )}

      <ChecklistMicroTareas visitaId={visita.id} disabled={!visitInProgress} onProgress={setAllTasksDone} />

      <button
        type="button"
        onClick={finalizar}
        disabled={saving || !visitInProgress || !allTasksDone || visitDone}
        className="touch-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-40"
      >
        <CheckCircle2 size={20} /> Finalizar visita
      </button>
    </div>
  );
}
