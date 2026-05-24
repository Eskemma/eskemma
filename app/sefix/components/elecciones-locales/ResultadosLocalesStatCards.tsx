"use client";
// Sin tarjeta de Voto Extranjero — no aplica en elecciones locales.
import type { ResultadosEleccionesData } from "@/types/sefix.types";

const FMT = new Intl.NumberFormat("es-MX");
const FMT_PCT = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function StatCard({ label, value, sub, note }: {
  label: string; value: string; sub?: string; note?: string;
}) {
  return (
    <div className="bg-white-eske dark:bg-[#18324A] border border-gray-eske-20 dark:border-white/10 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-black-eske-60 dark:text-[#9AAEBE] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-semibold text-black-eske dark:text-[#EAF2F8] tabular-nums">
        {value}
      </span>
      {sub && <span className="text-xs text-black-eske-60 dark:text-[#6D8294]">{sub}</span>}
      {note && <span className="text-[10px] text-black-eske-60/70 dark:text-[#6D8294]/70 italic mt-0.5">{note}</span>}
    </div>
  );
}

export default function ResultadosLocalesStatCards({ data }: { data: ResultadosEleccionesData }) {
  const ganador = data.partidos[0];
  const pctNulos =
    data.totalVotos > 0
      ? FMT_PCT.format((data.votosNulos / data.totalVotos) * 100)
      : "—";

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <StatCard
        label="Total de Votos"
        value={FMT.format(data.totalVotos)}
        sub={`${data.cargo} ${data.anio}`}
      />
      <StatCard
        label="Lista Nominal"
        value={FMT.format(data.lne)}
        sub="Ciudadanos habilitados"
      />
      <StatCard
        label="Participación"
        value={`${FMT_PCT.format(data.participacion)}%`}
        sub={ganador ? `1°: ${ganador.partido} (${FMT_PCT.format(ganador.porcentaje)}%)` : undefined}
      />
      <StatCard
        label="Votos Nulos"
        value={FMT.format(data.votosNulos)}
        sub={`${pctNulos}% del total`}
      />
    </div>
  );
}
