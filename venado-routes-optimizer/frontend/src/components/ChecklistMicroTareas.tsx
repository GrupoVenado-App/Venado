import { Camera, Check, ImageIcon, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, assetUrl } from "../api/client";
import { MicroTareaEjecucion } from "../types";

interface Props {
  visitaId: string;
  disabled?: boolean;
  onProgress?: (completed: boolean) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChecklistMicroTareas({ visitaId, disabled = false, onProgress }: Props) {
  const [items, setItems] = useState<MicroTareaEjecucion[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get<MicroTareaEjecucion[]>(`/visitas/${visitaId}/micro-tareas`);
    setItems(data);
  }

  useEffect(() => {
    load();
  }, [visitaId]);

  const allDone = useMemo(() => items.length > 0 && items.every((item) => item.completada), [items]);

  useEffect(() => {
    onProgress?.(allDone);
  }, [allDone, onProgress]);

  async function start(id: string) {
    setLoadingId(id);
    try {
      await api.post(`/ejecuciones-micro-tarea/${id}/iniciar`);
      await load();
    } finally {
      setLoadingId(null);
    }
  }

  async function finish(id: string, file?: File) {
    setLoadingId(id);
    try {
      const item = items.find((task) => task.id === id);
      if (item && !item.hora_inicio) {
        await api.post(`/ejecuciones-micro-tarea/${id}/iniciar`);
      }
      const payload = file ? { foto_base64: await fileToBase64(file) } : {};
      await api.post(`/ejecuciones-micro-tarea/${id}/finalizar`, payload);
      await load();
      toast.success(file ? "Foto guardada y micro-tarea completada" : "Micro-tarea completada");
    } finally {
      setLoadingId(null);
    }
  }

  async function toggle(id: string) {
    setLoadingId(id);
    try {
      await api.post(`/ejecuciones-micro-tarea/${id}/completar`);
      await load();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          {item.foto_evidencia_url ? (
            <a
              href={assetUrl(item.foto_evidencia_url) || "#"}
              target="_blank"
              rel="noreferrer"
              className="mb-3 block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            >
              <img
                src={assetUrl(item.foto_evidencia_url) || ""}
                alt={`Evidencia de ${item.nombre}`}
                className="h-36 w-full object-cover"
              />
            </a>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">{item.nombre}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {item.marca || "MULTIMARCA"} · {item.tiempo_estimado_minutos} min
              </p>
            </div>
            <button
              type="button"
              aria-label="Completar"
              onClick={() => toggle(item.id)}
              disabled={disabled || loadingId === item.id}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border ${
                item.completada ? "border-skyroute bg-skyroute text-white" : "border-slate-300 bg-white text-slate-500"
              } disabled:opacity-40`}
            >
              <Check size={20} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => start(item.id)}
              disabled={disabled || loadingId === item.id || Boolean(item.hora_inicio)}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-slate-100 px-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              aria-label="Iniciar tarea"
            >
              <Play size={18} />
              Iniciar
            </button>
            <label className="touch-button inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-100 text-slate-700">
              {item.foto_evidencia_url ? <ImageIcon size={18} /> : <Camera size={18} />}
              <input
                className="hidden"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={disabled || loadingId === item.id}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) finish(item.id, file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => finish(item.id)}
              disabled={disabled || loadingId === item.id || !item.hora_inicio || item.completada}
              className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-venado px-2 text-sm font-semibold text-white disabled:opacity-40"
              aria-label="Finalizar tarea"
            >
              <Square size={18} />
              Fin
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
