import { CheckCircle2, LocateFixed, MapPin, Navigation, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function VisitaPage() {
  const { visitaId } = useParams();
  const navigate = useNavigate();
  const { coords, setCoords, error, loading, request } = useGeolocation();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [allTasksDone, setAllTasksDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get<Visita>(`/visitas/${visitaId}`);
    setVisita(data);
  }

  useEffect(() => {
    load();
  }, [visitaId]);

  const meters = useMemo(() => {
    if (!coords || !visita) return null;
    return distanceMeters(coords, { latitud: visita.pdv.latitud, longitud: visita.pdv.longitud });
  }, [coords, visita]);

  const canStartVisit = Boolean(
    coords && visita && visita.estado === "PENDIENTE" && meters !== null && meters <= 200 && !saving,
  );
  const visitInProgress = visita?.estado === "EN_PROGRESO";

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

  async function iniciar() {
    if (!coords) return toast.error("Ubicacion requerida");
    setSaving(true);
    try {
      await api.post(`/visitas/${visitaId}/iniciar`, coords);
      toast.success("Visita iniciada");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function finalizar() {
    if (!coords) return toast.error("Ubicacion requerida");
    setSaving(true);
    try {
      await api.post(`/visitas/${visitaId}/finalizar`, coords);
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
            {visita.pdv.tiempo_visita_estimado_min} min
          </span>
        </div>
      </section>

      <MapaLaPaz pdvs={mapData} currentLocation={coords} heightClass="h-[260px]" zoom={15} />

      {meters !== null && meters > 200 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Te encuentras a {meters.toFixed(0)} metros. Acercate al PDV.
        </div>
      ) : null}
      {error ? <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">{error}</div> : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={request}
          className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 font-semibold text-slate-700 shadow-soft"
        >
          <LocateFixed size={18} /> {loading ? "Buscando" : "Ubicar"}
        </button>
        <button
          type="button"
          onClick={() => setCoords({ latitud: visita.pdv.latitud, longitud: visita.pdv.longitud })}
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
        {visitInProgress ? "Visita en progreso" : "Iniciar visita"}
      </button>

      {!visitInProgress && visita.estado !== "COMPLETADA" ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600">
          Primero inicia la visita cerca del PDV. Luego se habilitan los tiempos de cada micro-tarea.
        </div>
      ) : null}

      <ChecklistMicroTareas visitaId={visita.id} disabled={!visitInProgress} onProgress={setAllTasksDone} />

      <button
        type="button"
        onClick={finalizar}
        disabled={saving || !visitInProgress || !allTasksDone || visita.estado === "COMPLETADA"}
        className="touch-button inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-40"
      >
        <CheckCircle2 size={20} /> Finalizar visita
      </button>
    </div>
  );
}
