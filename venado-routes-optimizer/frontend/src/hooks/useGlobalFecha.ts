import { useEffect, useState } from "react";

export function useGlobalFecha() {
  const [fecha, setFechaState] = useState(() => localStorage.getItem("globalFecha") || "");

  const setFecha = (nuevaFecha: string) => {
    localStorage.setItem("globalFecha", nuevaFecha);
    setFechaState(nuevaFecha);
    window.dispatchEvent(new Event("globalFechaChanged"));
  };

  useEffect(() => {
    const handleStorage = () => {
      setFechaState(localStorage.getItem("globalFecha") || "");
    };
    window.addEventListener("globalFechaChanged", handleStorage);
    return () => window.removeEventListener("globalFechaChanged", handleStorage);
  }, []);

  return [fecha, setFecha] as const;
}
