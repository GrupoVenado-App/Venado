import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { clearSession, getToken } from "./api/client";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { FieldLayout } from "./layouts/FieldLayout";
import { BiExportPage } from "./pages/BiExportPage";
import { DashboardMapPage } from "./pages/DashboardMapPage";
import { DashboardMercadosPage } from "./pages/DashboardMercadosPage";
import { DashboardReponedoresPage } from "./pages/DashboardReponedoresPage";
import { DashboardRutasPage } from "./pages/DashboardRutasPage";
import { DmaicPage } from "./pages/DmaicPage";
import { LoginPage } from "./pages/LoginPage";
import { OptimizadorPage } from "./pages/OptimizadorPage";
import { ReponedorDetallePage } from "./pages/ReponedorDetallePage";
import { ReportesPage } from "./pages/ReportesPage";
import { RutaMapaPage } from "./pages/RutaMapaPage";
import { RutaHoyPage } from "./pages/RutaHoyPage";
import { VisitaPage } from "./pages/VisitaPage";

function RequireAuth({ role, children }: { role?: "supervisor" | "reponedor"; children: JSX.Element }) {
  const token = getToken();
  const storedRole = localStorage.getItem("venado_role");
  if (!token) return <Navigate to="/login" replace />;
  if (role && storedRole !== role) {
    clearSession();
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RootRedirect() {
  const role = localStorage.getItem("venado_role");
  if (role === "reponedor") return <Navigate to="/app/ruta-hoy" replace />;
  if (role === "supervisor") return <Navigate to="/dashboard/mapa" replace />;
  return <Navigate to="/login" replace />;
}

const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/app",
    element: (
      <RequireAuth role="reponedor">
        <FieldLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app/ruta-hoy" replace /> },
      { path: "ruta-hoy", element: <RutaHoyPage /> },
      { path: "mapa", element: <RutaMapaPage /> },
      { path: "visita/:visitaId", element: <VisitaPage /> },
    ],
  },
  {
    element: (
      <RequireAuth role="supervisor">
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/dashboard", element: <Navigate to="/dashboard/mapa" replace /> },
      { path: "/dashboard/mapa", element: <DashboardMapPage /> },
      { path: "/dashboard/rutas", element: <DashboardRutasPage /> },
      { path: "/dashboard/reponedores", element: <DashboardReponedoresPage /> },
      { path: "/dashboard/mercados", element: <DashboardMercadosPage /> },
      { path: "/dashboard/reportes", element: <ReportesPage /> },
      { path: "/dashboard/reportes/:reponedorId", element: <ReponedorDetallePage /> },
      { path: "/dashboard/dmaic", element: <DmaicPage /> },
      { path: "/dashboard/bi-export", element: <BiExportPage /> },
      { path: "/optimizador", element: <OptimizadorPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
