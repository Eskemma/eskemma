// F3Veredicto.tsx — M4: veredicto sobre la HEI, o progreso hacia la
// suficiencia si aún no se puede generar.
"use client";

import type { TareaPIP, VeredictoHEI } from "@/types/moddulo.types";
import { contarTareasCubiertas } from "@/lib/moddulo/f3Suficiencia";
import PillButton from "@/app/moddulo/components/PillButton";

const RESULTADO_LABELS: Record<VeredictoHEI["resultado"], string> = {
  validada: "HEI validada",
  ajustada: "HEI ajustada",
  refutada: "HEI refutada",
};

export default function F3Veredicto({
  veredicto, tareas, readOnly, onGenerar, onAprobar, generando, aprobando,
}: {
  veredicto: VeredictoHEI | undefined;
  tareas: TareaPIP[];
  readOnly?: boolean;
  onGenerar: () => Promise<void>;
  onAprobar: () => Promise<void>;
  generando: boolean;
  aprobando: boolean;
}) {
  const { cubiertas, total } = contarTareasCubiertas(tareas);
  const puedeGenerar = total > 0 && cubiertas === total;

  if (!veredicto) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center space-y-2">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
          {cubiertas} de {total} tareas cubiertas.
        </p>
        {!readOnly && (
          <PillButton variant="solid" onClick={onGenerar} disabled={generando || !puedeGenerar}>
            {generando ? "Generando…" : "Generar veredicto (M4)"}
          </PillButton>
        )}
        {!puedeGenerar && total > 0 && (
          <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
            Aún faltan tareas por cubrir (con un resultado real, o clasificadas como vacío residual en la síntesis).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-xs lg:text-sm font-bold bg-bluegreen-eske/10 text-bluegreen-eske dark:text-blue-eske-20">
          {RESULTADO_LABELS[veredicto.resultado]}
        </span>
        {veredicto.aprobadoPorUsuario && (
          <span className="px-2 py-0.5 rounded-full text-xs lg:text-sm font-medium bg-green-eske/15 text-green-eske">Aprobado</span>
        )}
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold text-black-eske-80 dark:text-[#9AAEBE]">Contraste</p>
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#C5D8E8]">{veredicto.contraste}</p>
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold text-black-eske-80 dark:text-[#9AAEBE]">Argumentación</p>
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#C5D8E8]">{veredicto.argumentacion}</p>
      </div>
      <div>
        <p className="text-xs lg:text-sm font-bold text-black-eske-80 dark:text-[#9AAEBE]">Premisa resultante</p>
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#C5D8E8]">{veredicto.premisaResultante}</p>
      </div>
      {!readOnly && !veredicto.aprobadoPorUsuario && (
        <PillButton variant="solid" onClick={onAprobar} disabled={aprobando}>
          {aprobando ? "Aprobando…" : "Aprobar veredicto"}
        </PillButton>
      )}
    </div>
  );
}
