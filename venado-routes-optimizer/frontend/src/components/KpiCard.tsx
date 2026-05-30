import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
}

export function KpiCard({ title, value, delta, icon: Icon }: Props) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700">
          <Icon size={20} />
        </span>
      </div>
      {delta ? <p className="mt-3 text-sm text-slate-500">{delta}</p> : null}
    </section>
  );
}
