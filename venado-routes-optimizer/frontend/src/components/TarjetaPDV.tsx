import { Clock, MapPinned, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Visita } from "../types";
import { estadoClasses } from "../utils/colors";
import { BadgeTipo } from "./BadgeTipo";

export function TarjetaPDV({ visita }: { visita: Visita }) {
  const className = estadoClasses[visita.estado] || estadoClasses.PENDIENTE;
  return (
    <article className={`rounded-md border p-4 shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink">{visita.pdv.codigo}</span>
            <BadgeTipo tipo={visita.pdv.tipo_cliente} />
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold text-ink">{visita.pdv.nombre}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{visita.pdv.mercado}</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/80 text-slate-700">
          {visita.orden_planificado}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Clock size={16} /> {visita.pdv.tiempo_visita_estimado_min} min
        </span>
        <span className="inline-flex items-center gap-2" title="Distancia desde el PDV anterior en la ruta planificada">
          <MapPinned size={16} />
          {visita.distancia_desde_anterior_km != null
            ? `${visita.distancia_desde_anterior_km.toFixed(1)} km al PDV ant.`
            : "— km"}
        </span>
      </div>

      <Link
        to={`/app/visita/${visita.id}`}
        className="touch-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-skyroute px-4 py-3 text-sm font-semibold text-white"
      >
        <Play size={18} />
        {visita.estado === "EN_PROGRESO" ? "Continuar visita" : "Abrir visita"}
      </Link>
    </article>
  );
}
