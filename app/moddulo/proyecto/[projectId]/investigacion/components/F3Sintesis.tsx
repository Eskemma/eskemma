// F3Sintesis.tsx — M3: convergencias, contradicciones, vacíos residuales,
// insumos de FODA Propio / FODA de Adversarios.
"use client";

import type { SintesisF3, FODAInsumo, ActorVetoF2 } from "@/types/moddulo.types";
import PillButton from "@/app/moddulo/components/PillButton";

function FODAGrid({ foda }: { foda: FODAInsumo }) {
  // Defensivo: sintesis la genera Claude (JSON parseado) — un campo de FODA
  // faltante en la respuesta no debe tronar el render.
  const cuadrantes: { label: string; items: string[]; color: string }[] = [
    { label: "Fortalezas", items: foda.fortalezas ?? [], color: "bg-green-eske/10 text-green-eske" },
    { label: "Oportunidades", items: foda.oportunidades ?? [], color: "bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20" },
    { label: "Debilidades", items: foda.debilidades ?? [], color: "bg-yellow-eske/15 text-black-eske" },
    { label: "Amenazas", items: foda.amenazas ?? [], color: "bg-red-eske/10 text-red-eske" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {cuadrantes.map((c) => (
        <div key={c.label} className={`rounded-lg p-2 ${c.color}`}>
          <p className="text-xs lg:text-sm font-bold mb-1">{c.label}</p>
          <ul className="text-xs lg:text-sm space-y-0.5 list-disc list-inside">
            {c.items.length === 0 ? <li className="opacity-60">Sin elementos</li> : c.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function F3Sintesis({
  sintesis, actoresVeto, readOnly, onGenerar, generando, puedeGenerar,
}: {
  sintesis: SintesisF3 | undefined;
  actoresVeto: ActorVetoF2[];
  readOnly?: boolean;
  onGenerar: () => Promise<void>;
  generando: boolean;
  puedeGenerar: boolean;
}) {
  if (!sintesis) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mb-3">
          Aún no se ha generado la síntesis de hallazgos.
        </p>
        {!readOnly && (
          <PillButton variant="solid" onClick={onGenerar} disabled={generando || !puedeGenerar}>
            {generando ? "Generando…" : "Generar síntesis (M3)"}
          </PillButton>
        )}
      </div>
    );
  }

  // Defensivo: sintesis proviene de una respuesta JSON de Claude — un campo
  // ausente en la respuesta (ej. "fodaAdversariosInsumo" omitido cuando no
  // hay actores del Semáforo de Veto) no debe tronar el render.
  const convergencias = sintesis.convergencias ?? [];
  const contradicciones = sintesis.contradicciones ?? [];
  const vaciosResiduales = sintesis.vaciosResiduales ?? [];
  const fodaPropioInsumo = sintesis.fodaPropioInsumo ?? { fortalezas: [], oportunidades: [], debilidades: [], amenazas: [] };
  const fodaAdversariosInsumo = sintesis.fodaAdversariosInsumo ?? {};

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-1">Convergencias</p>
        <ul className="text-xs lg:text-sm space-y-1 list-disc list-inside text-black-eske-80 dark:text-[#C5D8E8]">
          {convergencias.map((c, i) => (
            <li key={i}>
              {c.texto}
              {c.sustentoUnico && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-yellow-eske/15 text-yellow-eske-70 dark:text-yellow-eske"
                  title="Toda la evidencia detrás de este hallazgo viene de una sola familia metodológica"
                >
                  Sustento único
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-1">Contradicciones</p>
        <ul className="text-xs lg:text-sm space-y-1 list-disc list-inside text-black-eske-80 dark:text-[#C5D8E8]">
          {contradicciones.length === 0 ? <li className="opacity-60">Ninguna detectada</li> : contradicciones.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-1">Vacíos residuales</p>
        <div className="space-y-1">
          {vaciosResiduales.length === 0 ? (
            <p className="text-xs lg:text-sm opacity-60">Ninguno</p>
          ) : vaciosResiduales.map((v) => (
            <div key={v.pipItemId} className="flex items-center justify-between text-xs lg:text-sm px-2 py-1 rounded bg-gray-eske-10/60 dark:bg-white/5">
              <span className="text-bluegreen-eske dark:text-blue-eske-20 font-semibold">P{v.numero} — {v.pregunta}</span>
              <span className={`px-1.5 py-0.5 rounded-full font-medium ${v.destino === "RDA" ? "bg-red-eske/10 text-red-eske" : "bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20"}`}>
                {v.destino} · {v.urgencia}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-1">Insumo FODA Propio</p>
        <FODAGrid foda={fodaPropioInsumo} />
      </div>
      {Object.entries(fodaAdversariosInsumo).map(([actorId, foda]) => {
        // El actor pudo renombrarse o eliminarse en F2 desde que se generó
        // esta síntesis — se prefiere el nombre VIGENTE del semáforo actual
        // (la edición se refleja sola, sin regenerar nada); si el actor ya
        // no existe, se usa el nombre congelado al momento de generar, con
        // una nota — el contenido del FODA nunca se pierde ni queda huérfano
        // sin explicación.
        const actorVigente = actoresVeto.find((a) => a.actorId === actorId);
        const nombreMostrado = actorVigente?.nombre ?? foda.nombreActor ?? actorId;
        return (
          <div key={actorId}>
            <p className="text-xs lg:text-sm font-bold uppercase tracking-widest text-black-eske-80 dark:text-[#9AAEBE] mb-1">
              Insumo FODA — {nombreMostrado}
              {!actorVigente && (
                <span className="ml-1.5 normal-case font-normal text-gray-eske-50 dark:text-[#6D8294]">(ya no está en el Semáforo vigente)</span>
              )}
            </p>
            <FODAGrid foda={foda} />
          </div>
        );
      })}
    </div>
  );
}
