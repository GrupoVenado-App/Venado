import { Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";

export function BiExportPage() {
  async function download() {
    const response = await api.get("/reportes/exportar-bi", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "venado_bi_export.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV generado");
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-ink">BI Export</h2>
      <section className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <button
          type="button"
          onClick={download}
          className="touch-button inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </section>
    </div>
  );
}
