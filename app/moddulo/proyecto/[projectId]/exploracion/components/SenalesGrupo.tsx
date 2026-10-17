// Group of signals (favorables / adversas / inciertas) of one PEST-L dimension in the F2 side panel.
// Shared by every kind of M1 (Express, Centinela T22 and projects created before the M1 review), so the
// foot of each signal looks the same everywhere.
//
// Foot of a signal, by design (not by shrinking the text): the SOURCE is its own block and may take as
// many lines as it needs (it is traceability: never cut or ellipsized); date, «Intl.» and confidence go
// together in a separate row where each piece is `whitespace-nowrap`, so the row wraps by pieces and a
// date like «2026-10» or «sin fecha» is never split inside.

import type { F2DimensionPESTEL } from "@/types/moddulo.types";

type Senal = F2DimensionPESTEL["senalesFavorables"][number];

export function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const CONFIANZA: Record<string, string> = {
  alto: "bg-green-eske-10 text-green-eske-70 dark:bg-green-eske/20 dark:text-[#7BC47C]",
  bajo: "bg-red-eske-10 text-red-eske-70 dark:bg-red-eske/20 dark:text-red-eske-10",
};
const CONFIANZA_OTRA = "bg-gray-eske-10 text-black-eske-20 dark:bg-white/10 dark:text-[#C7D6E0]";

export function PieSenal({ s }: { s: Senal }) {
  return (
    <div className="space-y-1 text-xs text-black-eske-20 dark:text-[#9AAEBE]" data-pie-senal>
      {s.fuente && <p className="break-words">{s.fuente}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {s.fechaCorte && <span className="whitespace-nowrap">{s.fechaCorte}</span>}
        {s.origenInternacional && (
          <span className="whitespace-nowrap px-1.5 py-0.5 bg-bluegreen-eske-10 text-bluegreen-eske-70 rounded text-xs dark:bg-bluegreen-eske/20 dark:text-blue-eske-20">
            Intl.
          </span>
        )}
        {s.nivelConfianza && (
          <span className={`whitespace-nowrap px-1.5 py-0.5 rounded text-xs ${CONFIANZA[s.nivelConfianza] ?? CONFIANZA_OTRA}`}>
            {s.nivelConfianza}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SenalesGrupo({
  title, signals, colorClass, summaryClass,
}: {
  title: string;
  signals: F2DimensionPESTEL["senalesFavorables"];
  colorClass: string;
  summaryClass: string;
}) {
  if (signals.length === 0) return null;
  return (
    <details className={`rounded-lg overflow-hidden ${summaryClass}`}>
      <summary className={`px-3 py-2 text-xs font-semibold cursor-pointer list-none flex items-center justify-between ${colorClass}`}>
        {title} <span className="text-black-eske-20">({signals.length})</span>
      </summary>
      <ul className="divide-y divide-gray-eske-20 dark:divide-white/5">
        {signals.map((s, i) => (
          <li key={i} className="px-3 py-2 space-y-1">
            <p className="text-xs text-black-eske dark:text-[#EAF2F8]"><InlineMarkdown text={s.descripcion} /></p>
            <PieSenal s={s} />
          </li>
        ))}
      </ul>
    </details>
  );
}
