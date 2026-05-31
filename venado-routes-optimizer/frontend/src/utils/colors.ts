import { TipoCliente } from "../types";

export const tipoColors: Record<TipoCliente, { bg: string; text: string; dot: string; stroke: string }> = {
  PARETO: { bg: "bg-red-100", text: "text-red-800", dot: "#c8102e", stroke: "#9f1239" },
  MAYORISTA: { bg: "bg-blue-100", text: "text-blue-800", dot: "#174ea6", stroke: "#1d4ed8" },
  MINORISTA: { bg: "bg-sky-100", text: "text-blue-800", dot: "#2563eb", stroke: "#174ea6" },
  DETALLISTA: { bg: "bg-red-50", text: "text-red-700", dot: "#e11d48", stroke: "#c8102e" },
};

export const estadoClasses = {
  PENDIENTE: "border-slate-200 bg-white",
  EN_TRASLADO: "border-blue-300 bg-blue-50",
  EN_PROGRESO: "border-red-300 bg-red-50",
  COMPLETADA: "border-blue-300 bg-blue-50",
  NO_VISITADO: "border-slate-300 bg-slate-100",
};
