import { ClipboardList, LogOut, Map, UserRound } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession } from "../api/client";

export function FieldLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("venado_user") || "{}");

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-field pb-20">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Industrias Venado</p>
            <h1 className="text-lg font-bold text-ink">{user.nombre || "Reponedor"}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="grid h-11 w-11 place-items-center rounded-md bg-slate-100 text-slate-700"
            aria-label="Salir"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          <NavLink
            to="/app/ruta-hoy"
            className={({ isActive }) =>
              `flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold ${
                isActive ? "text-venado" : "text-slate-500"
              }`
            }
          >
            <ClipboardList size={22} />
            Ruta
          </NavLink>
          <NavLink
            to="/app/mapa"
            className={({ isActive }) =>
              `flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold ${
                isActive ? "text-venado" : "text-slate-500"
              }`
            }
          >
            <Map size={22} />
            Mapa
          </NavLink>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500"
          >
            <UserRound size={22} />
            Salir
          </button>
        </div>
      </nav>
    </div>
  );
}
