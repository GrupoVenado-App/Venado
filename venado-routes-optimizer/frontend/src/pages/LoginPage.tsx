import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, setSession } from "../api/client";
import { BrandLogo } from "../components/BrandLogo";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("supervisor.1@venado.local");
  const [password, setPassword] = useState("supervisor123");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setSession(data.access_token, data.rol, data.user);
      toast.success(`Bienvenido, ${data.user.nombre}`);
      navigate(data.rol === "reponedor" ? "/app/ruta-hoy" : "/dashboard/mapa", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-field px-4">
      <section className="w-full max-w-md rounded-md border border-blue-100 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <BrandLogo className="mb-5 h-36 w-full rounded-md bg-venado object-contain shadow-sm" />
          <p className="text-sm font-semibold uppercase text-venado">Industrias Venado</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Rutas Canal Tradicional</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-venado"
              type="email"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-venado"
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="touch-button w-full rounded-md bg-venado px-4 py-3 font-semibold text-white transition-colors hover:bg-skyroute disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEmail("supervisor.1@venado.local");
              setPassword("supervisor123");
            }}
            className="touch-button rounded-md bg-blue-50 px-3 text-sm font-semibold text-skyroute"
          >
            Supervisor
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail("reponedor.1@venado.local");
              setPassword("reponedor123");
            }}
            className="touch-button rounded-md bg-red-50 px-3 text-sm font-semibold text-venado"
          >
            Reponedor
          </button>
        </div>
      </section>
    </main>
  );
}
