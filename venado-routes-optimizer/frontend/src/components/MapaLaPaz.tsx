import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import { FeatureCollection, TipoCliente } from "../types";
import { tipoColors } from "../utils/colors";

const center: [number, number] = [-16.5, -68.1193];
const routePalette = ["#b91c1c", "#2563eb", "#15803d", "#f97316", "#7c3aed", "#0f766e", "#be123c"];

interface Props {
  pdvs?: FeatureCollection | null;
  rutas?: FeatureCollection | null;
  currentLocation?: { latitud: number; longitud: number } | null;
  /** ORS road geometry from currentLocation → target PDV as [[lng, lat], ...] */
  navRoute?: [number, number][] | null;
  heightClass?: string;
  zoom?: number;
}

export function MapaLaPaz({ pdvs, rutas, currentLocation, navRoute, heightClass = "h-[560px]", zoom = 13 }: Props) {
  return (
    <div className={`${heightClass} overflow-hidden rounded-md border border-slate-200 bg-white`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route lines (supervisor view) */}
        {rutas?.features.map((feature, index) => {
          if (feature.geometry.type !== "LineString") return null;
          const coords = feature.geometry.coordinates as Array<[number, number]>;
          return (
            <Polyline
              key={`route-${index}`}
              pathOptions={{ color: routePalette[index % routePalette.length], weight: 4, opacity: 0.78 }}
              positions={coords.map(([lng, lat]) => [lat, lng])}
            />
          );
        })}

        {/* Live navigation route: currentLocation → PDV (dashed blue) */}
        {navRoute && navRoute.length >= 2 && (
          <Polyline
            pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85, dashArray: "10 8" }}
            positions={navRoute.map(([lng, lat]) => [lat, lng])}
          />
        )}

        {/* PDV markers */}
        {pdvs?.features.map((feature) => {
          if (feature.geometry.type !== "Point") return null;
          const [lng, lat] = feature.geometry.coordinates as [number, number];
          const tipo = String(feature.properties.tipo_cliente || "MINORISTA") as TipoCliente;
          const color = tipoColors[tipo]?.dot || "#475569";
          return (
            <CircleMarker
              key={String(feature.properties.id || feature.properties.visita_id || `${lat}-${lng}`)}
              center={[lat, lng]}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: color, fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="min-w-40">
                  <strong>{feature.properties.codigo}</strong>
                  <p className="m-0 text-sm">{feature.properties.mercado}</p>
                  <p className="m-0 text-xs">{feature.properties.tipo_cliente}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Current location marker (pulsing blue) */}
        {currentLocation ? (
          <CircleMarker
            center={[currentLocation.latitud, currentLocation.longitud]}
            radius={8}
            pathOptions={{ color: "#0f172a", weight: 2, fillColor: "#38bdf8", fillOpacity: 0.9 }}
          >
            <Popup>Ubicación actual</Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  );
}
