"use client";

// app/moddulo/components/RDAHistoryModal.tsx
// Modal centralizado del Registro de Deficiencias Activas — reemplaza el
// banner inline que existía en F2 (RDAHeredadoSection, eliminado) y la
// sección embebida que existía en el reporte de F1 (RDASection, eliminada
// de PhaseReportView.tsx). Único punto de acceso al RDA en todo el
// proyecto, sin importar la fase — evita el riesgo de dos copias de
// estado local desincronizadas para el mismo dato.

import { useState } from "react";
import type { PhaseId, RDAItem } from "@/types/moddulo.types";
import { PHASE_ORDER, PHASE_NAMES } from "@/types/moddulo.types";
import { getVinculacionPESTEL } from "@/lib/moddulo/rdaPestelLink";
import { getDisplayTextForRDAItem } from "@/lib/moddulo/rda";
import { useFocusTrap } from "@/app/hooks/useFocusTrap";
import { useEscapeKey } from "@/app/hooks/useEscapeKey";
import ConfirmAcceptRDAModal from "@/app/moddulo/components/ConfirmAcceptRDAModal";

const DIMENSION_LABEL_ES: Record<string, string> = {
  P: "Político", E: "Económico", S: "Social", T: "Tecnológico", Ec: "Ecológico", L: "Legal",
};

export default function RDAHistoryModal({
  rda,
  projectId,
  onClose,
  onAccepted,
}: {
  rda: Record<string, RDAItem>;
  projectId: string;
  onClose: () => void;
  onAccepted: (itemId: string) => void;
}) {
  const modalRef = useFocusTrap(true);
  useEscapeKey(true, onClose);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const gruposPorFase = PHASE_ORDER.map((phaseId) => ({
    phaseId,
    items: Object.values(rda).filter((item) => item.faseOrigen === phaseId),
  })).filter((g) => g.items.length > 0);

  const acceptingItem = acceptingId ? rda[acceptingId] : undefined;

  const handleConfirmAccept = async () => {
    if (!acceptingId) return;
    setIsAccepting(true);
    try {
      const r = await fetch(`/api/moddulo/projects/${projectId}/rda/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId: acceptingId }),
      });
      if (r.ok) onAccepted(acceptingId);
    } finally {
      setIsAccepting(false);
      setAcceptingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rda-history-title"
        className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-eske-20 dark:border-white/10">
          <h2 id="rda-history-title" className="font-bold text-black-eske dark:text-[#EAF2F8]">
            Registro de Deficiencias Activas (RDA)
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-eske-10 dark:hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5 text-gray-eske-60 dark:text-[#9AAEBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {gruposPorFase.length === 0 && (
            <p className="text-sm text-black-eske-80 dark:text-[#9AAEBE] italic">
              Sin deficiencias registradas todavía.
            </p>
          )}
          {gruposPorFase.map(({ phaseId, items }) => (
            <div key={phaseId}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-bluegreen-eske dark:text-[#6BA4C6] mb-3">
                {PHASE_NAMES[phaseId as PhaseId]}
              </h3>
              <div className="space-y-3">
                {items.map((item) => {
                  const isAceptado = item.estado === "aceptado";
                  const dims = getVinculacionPESTEL(item.criterioId);
                  const { nombre, descripcion, recomendacion } = getDisplayTextForRDAItem(item);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 ${
                        isAceptado
                          ? "border-gray-eske-30 bg-gray-eske-10/50 dark:border-white/10 dark:bg-white/5"
                          : item.nivelImpacto === "prioritario"
                            ? "border-red-eske/30 bg-red-eske/5"
                            : "border-purple-200 bg-purple-50 dark:border-yellow-eske/30 dark:bg-yellow-eske/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`text-xs font-bold ${
                          isAceptado
                            ? "text-black-eske-80 dark:text-[#9AAEBE]"
                            : item.nivelImpacto === "prioritario" ? "text-red-eske" : "text-purple-700 dark:text-yellow-eske"
                        }`}>
                          {nombre}
                        </p>
                        {isAceptado && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-eske-20 text-black-eske-80 dark:bg-white/10 dark:text-[#C7D6E0] shrink-0">
                            Aceptado como condición
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-black-eske-80 dark:text-[#C7D6E0] mb-2">{descripcion}</p>
                      {recomendacion && (
                        <p className="text-xs text-bluegreen-eske dark:text-[#6BA4C6] font-medium mb-1">
                          ↳ {recomendacion}
                        </p>
                      )}
                      {dims.length > 0 && (
                        <p className="text-[11px] text-black-eske-80 dark:text-[#9AAEBE] mb-1">
                          Dimensiones PESTEL más afectadas: {dims.map((d) => DIMENSION_LABEL_ES[d] ?? d).join(", ")}
                        </p>
                      )}
                      {!isAceptado && (
                        <button
                          onClick={() => setAcceptingId(item.id)}
                          className="mt-1 text-xs font-medium text-bluegreen-eske underline hover:text-bluegreen-eske-60 dark:text-[#6BA4C6]"
                        >
                          Aceptar como condición del proyecto
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {acceptingId && acceptingItem && (
        <ConfirmAcceptRDAModal
          itemNombre={getDisplayTextForRDAItem(acceptingItem).nombre}
          isConfirming={isAccepting}
          onCancel={() => setAcceptingId(null)}
          onConfirm={handleConfirmAccept}
        />
      )}
    </div>
  );
}
