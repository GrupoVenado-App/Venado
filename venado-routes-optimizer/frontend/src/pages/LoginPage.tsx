import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, setSession } from "../api/client";

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
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-venado">Industrias Venado</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Rutas Canal Tradicional</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
              type="email"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-slate-900"
              type="password"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="touch-button w-full rounded-md bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
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
            className="touch-button rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700"
          >
            Supervisor
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail("reponedor.1@venado.local");
              setPassword("reponedor123");
            }}
            className="touch-button rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700"
          >
            Reponedor
          </button>
        </div>
      </section>
    </main>
  );
}
