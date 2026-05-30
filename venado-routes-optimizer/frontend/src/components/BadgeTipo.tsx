import { TipoCliente } from "../types";
import { tipoColors } from "../utils/colors";

export function BadgeTipo({ tipo }: { tipo: TipoCliente }) {
  const color = tipoColors[tipo];
  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${color.bg} ${color.text}`}>
      {tipo}
    </span>
  );
}
