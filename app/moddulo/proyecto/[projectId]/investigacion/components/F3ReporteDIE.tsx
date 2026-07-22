// F3ReporteDIE.tsx — Estado Lista, pestaña "Reporte F3": los 8 componentes
// del DIE (FAT 2.0 v2.0, Capa 4).
"use client";

import type { DIE, RDAItem } from "@/types/moddulo.types";
import { asignacionEtiquetaCompleta } from "@/lib/moddulo/asignacionLabel";
import F3Sintesis from "./F3Sintesis";
import F3Veredicto from "./F3Veredicto";

export default function F3ReporteDIE({ die, rda }: { die: DIE; rda?: Record<string, RDAItem> }) {
  const rdaDeInvestigacion = Object.values(rda ?? {}).filter((r) => r.faseOrigen === "investigacion");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">1–3. Síntesis por dimensión + insumos FODA</h2>
        <F3Sintesis sintesis={die.sintesisPorDimension} readOnly onGenerar={async () => {}} generando={false} puedeGenerar={false} />
      </section>

      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">4. Tablero de tareas del PIP (estado final)</h2>
        <div className="space-y-1">
          {die.tableroTareasPIP.map((t) => (
            <div key={t.numero} className="flex items-center justify-between text-xs lg:text-sm px-2 py-1 rounded bg-gray-eske-10/60 dark:bg-white/5">
              <span className="text-bluegreen-eske font-semibold">P{t.numero}</span>
              <span className="font-medium">
                {(t.asignaciones ?? []).map((a) => `${asignacionEtiquetaCompleta(a)}: ${a.estado}`).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">5. Veredicto HEI</h2>
        <F3Veredicto
          veredicto={die.veredictoHEI}
          tareas={die.tableroTareasPIP}
          readOnly
          onGenerar={async () => {}}
          onAprobar={async () => {}}
          generando={false}
          aprobando={false}
        />
      </section>

      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">6. Inventario de Activos de Inteligencia (IAI)</h2>
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">Fuera de alcance en esta entrega — pendiente.</p>
      </section>

      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">7. Vacíos residuales</h2>
        <div className="space-y-1">
          {die.sintesisPorDimension.vaciosResiduales.length === 0 ? (
            <p className="text-xs lg:text-sm opacity-60">Ninguno</p>
          ) : die.sintesisPorDimension.vaciosResiduales.map((v) => (
            <div key={v.numero} className="flex items-center justify-between text-xs lg:text-sm px-2 py-1 rounded bg-gray-eske-10/60 dark:bg-white/5">
              <span className="text-bluegreen-eske font-semibold">P{v.numero} — {v.pregunta}</span>
              <span className="font-medium">{v.destino}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-bluegreen-eske mb-2">8. RDA actualizado</h2>
        {rdaDeInvestigacion.length === 0 ? (
          <p className="text-xs lg:text-sm opacity-60">Sin deficiencias registradas desde F3.</p>
        ) : (
          <ul className="text-xs lg:text-sm space-y-1 list-disc list-inside">
            {rdaDeInvestigacion.map((r) => <li key={r.id}>{r.nombre} — {r.estado}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
