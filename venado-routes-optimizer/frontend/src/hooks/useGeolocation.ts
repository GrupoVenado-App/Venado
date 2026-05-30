import { useCallback, useEffect, useState } from "react";

export interface Coords {
  latitud: number;
  longitud: number;
}

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalizacion no disponible");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitud: position.coords.latitude, longitud: position.coords.longitude });
        setError(null);
        setLoading(false);
      },
      (geoError) => {
        setError(geoError.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return { coords, setCoords, error, loading, request };
}
