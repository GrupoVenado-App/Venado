import { TipoCliente } from "../types";

export const tipoColors: Record<TipoCliente, { bg: string; text: string; dot: string; stroke: string }> = {
  PARETO: { bg: "bg-red-100", text: "text-red-800", dot: "#dc2626", stroke: "#b91c1c" },
  MAYORISTA: { bg: "bg-orange-100", text: "text-orange-800", dot: "#f97316", stroke: "#ea580c" },
  MINORISTA: { bg: "bg-blue-100", text: "text-blue-800", dot: "#2563eb", stroke: "#1d4ed8" },
  DETALLISTA: { bg: "bg-green-100", text: "text-green-800", dot: "#16a34a", stroke: "#15803d" },
};

export const estadoClasses = {
  PENDIENTE: "border-slate-200 bg-white",
  EN_PROGRESO: "border-amber-300 bg-amber-50",
  COMPLETADA: "border-green-300 bg-green-50",
  NO_VISITADO: "border-slate-300 bg-slate-100",
};
