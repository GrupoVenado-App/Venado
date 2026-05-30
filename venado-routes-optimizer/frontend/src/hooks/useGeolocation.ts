import { useCallback, useEffect, useRef, useState } from "react";

export interface Coords {
  latitud: number;
  longitud: number;
}

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const watchId = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible en este dispositivo");
      return;
    }
    stopWatch();
    setLoading(true);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({ latitud: position.coords.latitude, longitud: position.coords.longitude });
        setError(null);
        setLoading(false);
      },
      (geoError) => {
        setError(geoError.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, [stopWatch]);

  // One-shot request (for the Ubicar button)
  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible");
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

  // Start watching automatically on mount, stop on unmount
  useEffect(() => {
    startWatch();
    return stopWatch;
  }, [startWatch, stopWatch]);

  return { coords, setCoords, error, loading, request, startWatch, stopWatch };
}
