import {
  BarChart3,
  Download,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Route,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession } from "../api/client";

const links = [
  { to: "/dashboard/mapa", label: "Mapa", icon: MapPinned },
  { to: "/dashboard/rutas", label: "Rutas", icon: Route },
  { to: "/dashboard/reponedores", label: "Reponedores", icon: Users },
  { to: "/dashboard/mercados", label: "Mercados", icon: BarChart3 },
  { to: "/dashboard/reportes", label: "Reportes", icon: FileText },
  { to: "/dashboard/bi-export", label: "BI Export", icon: Download },
  { to: "/optimizador", label: "Optimizador", icon: GitBranch },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("venado_user") || "{}");

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-field lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block">
        <div className="flex min-h-screen flex-col p-4">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-venado text-white">
              <LayoutDashboard size={21} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Trade La Paz</p>
              <h1 className="font-bold text-ink">Venado Rutas</h1>
            </div>
          </div>

          <nav className="space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold ${
                    isActive ? "bg-venado text-white" : "text-slate-600 hover:bg-blue-50 hover:text-skyroute"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-4">
            <p className="truncate text-sm font-semibold text-ink">{user.nombre || "Supervisor"}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-50 text-sm font-semibold text-skyroute"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <strong>Venado Rutas</strong>
            <button className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-skyroute" onClick={logout} aria-label="Salir">
              <LogOut size={18} />
            </button>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `shrink-0 rounded px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-venado text-white" : "bg-blue-50 text-skyroute"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
