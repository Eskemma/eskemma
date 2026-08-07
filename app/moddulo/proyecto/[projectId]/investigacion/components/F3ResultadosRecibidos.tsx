// F3ResultadosRecibidos.tsx — M2: resultados recibidos, organizados por
// módulo del PIP, con origen/cobertura visibles y aprobación explícita.
"use client";

import { useState } from "react";
import type { TareaPIP, PIPItem, AsignacionCanal } from "@/types/moddulo.types";
import { asignacionEtiquetaCompleta } from "@/lib/moddulo/asignacionLabel";
import PillButton from "@/app/moddulo/components/PillButton";

interface ResultadoDoc {
  resultadoId: string;
  moduloPIP: string;
  origen: { sourceKind: string; componente: string; fechaEntrega: string };
  cobertura: { completa: boolean; detalle?: string };
  aprobado?: boolean;
  notasUsuario?: string;
}

interface Props {
  resultados: ResultadoDoc[];
  tareas: TareaPIP[];
  pip: PIPItem[];
  projectId: string;
  readOnly?: boolean;
  onAprobado: () => void;
}

// "manual" (Canal 2) y "external" (Canal 3) son literales fijos de
// OrigenTrazabilidad.sourceKind; cualquier otro valor es un TecnicaId → Canal 1.
function sourceKindToCanal(sourceKind: string): AsignacionCanal["canal"] {
  if (sourceKind === "manual") return "canal2";
  if (sourceKind === "external") return "canal3";
  return "canal1";
}

export default function F3ResultadosRecibidos({ resultados, tareas, pip, projectId, readOnly, onAprobado }: Props) {
  const [pipItemIdSeleccion, setPipItemIdSeleccion] = useState<Record<string, string>>({});
  const [asignacionSeleccion, setAsignacionSeleccion] = useState<Record<string, string>>({});

  if (resultados.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-gray-eske-20 dark:border-white/10 bg-gray-eske-10/40 dark:bg-[#112230] text-center">
        <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
          Todavía no ha llegado ningún resultado de investigación.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {resultados.map((r) => {
        const pipItemId = pipItemIdSeleccion[r.resultadoId];
        const tarea = tareas.find((t) => t.pipItemId === pipItemId);
        const canalEsperado = sourceKindToCanal(r.origen.sourceKind);
        let candidatas = tarea?.asignaciones?.filter((a) => a.canal === canalEsperado && !a.resultadoId) ?? [];
        if (tarea && candidatas.length === 0) {
          // Fallback: ninguna asignación coincide con el canal esperado —
          // mostrar todas las no resueltas de la tarea en vez de bloquear.
          candidatas = (tarea.asignaciones ?? []).filter((a) => !a.resultadoId);
        }
        const asignacionId = candidatas.length === 1 ? candidatas[0].asignacionId : asignacionSeleccion[r.resultadoId];

        return (
          <div key={r.resultadoId} className="rounded-lg border border-gray-eske-20 dark:border-white/10 p-3 bg-white-eske dark:bg-[#18324A]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs lg:text-sm font-semibold text-black-eske dark:text-[#EAF2F8] truncate">{r.moduloPIP}</p>
                <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE] mt-0.5">
                  Origen: {r.origen.componente} ({r.origen.sourceKind}) — {new Date(r.origen.fechaEntrega).toLocaleDateString("es-MX")}
                </p>
                <p className="text-xs lg:text-sm text-black-eske-80 dark:text-[#9AAEBE]">
                  Cobertura: {r.cobertura.completa ? "completa" : "parcial"}{r.cobertura.detalle ? ` — ${r.cobertura.detalle}` : ""}
                </p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs lg:text-sm font-medium ${
                r.aprobado ? "bg-green-eske/15 text-green-eske" : "bg-gray-eske-20 text-black-eske-80"
              }`}>
                {r.aprobado ? "Aprobado" : "Sin revisar"}
              </span>
            </div>

            {!readOnly && !r.aprobado && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <select
                  value={pipItemId ?? ""}
                  onChange={(e) => {
                    setPipItemIdSeleccion((prev) => ({ ...prev, [r.resultadoId]: e.target.value }));
                    setAsignacionSeleccion((prev) => ({ ...prev, [r.resultadoId]: "" }));
                  }}
                  className="text-xs lg:text-sm px-2 py-1 rounded border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230]"
                >
                  <option value="">¿A qué tarea del PIP responde?</option>
                  {tareas.map((t) => {
                    const item = pip.find((p) => p.numero === t.numero);
                    return <option key={t.pipItemId} value={t.pipItemId}>P{t.numero} — {item?.pregunta ?? ""}</option>;
                  })}
                </select>

                {tarea && candidatas.length > 1 && (
                  <select
                    value={asignacionSeleccion[r.resultadoId] ?? ""}
                    onChange={(e) => setAsignacionSeleccion((prev) => ({ ...prev, [r.resultadoId]: e.target.value }))}
                    className="text-xs lg:text-sm px-2 py-1 rounded border border-gray-eske-20 dark:border-white/10 bg-white-eske dark:bg-[#112230]"
                  >
                    <option value="">¿Cuál asignación?</option>
                    {candidatas.map((a) => (
                      <option key={a.asignacionId} value={a.asignacionId}>
                        {asignacionEtiquetaCompleta(a)} — {a.justificacion.slice(0, 40)}…
                      </option>
                    ))}
                  </select>
                )}

                <PillButton
                  disabled={!pipItemId || !asignacionId}
                  onClick={async () => {
                    await fetch("/api/moddulo/f3/resultados/aprobar", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId, resultadoId: r.resultadoId, pipItemId, asignacionId, aprobado: true }),
                    });
                    onAprobado();
                  }}
                >
                  Aprobar
                </PillButton>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
