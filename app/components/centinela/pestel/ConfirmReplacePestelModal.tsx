"use client";

// app/components/centinela/pestel/ConfirmReplacePestelModal.tsx
// Confirmación explícita antes de reemplazar el M1/vínculo PESTEL vigente
// de un proyecto Moddulo por otro de fuente distinta. Compartido entre
// exploracion/page.tsx (relink / re-sync) y centinela/pestel/nuevo/page.tsx
// (upgrade express→Centinela o reemplazo de un vínculo Centinela previo).

export type ConfirmReplacePestelSource = "relink" | "sync" | "recreate";

export default function ConfirmReplacePestelModal({ source, isConfirming, onCancel, onConfirm }: {
  source: ConfirmReplacePestelSource;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    source === "relink" ? "¿Restaurar el análisis de Centinela PESTEL?" :
    source === "recreate" ? "¿Reemplazar tu vínculo con Centinela PESTEL?" :
    "¿Reemplazar tu análisis express?";

  const body =
    source === "recreate"
      ? "Ya tienes un análisis de Centinela PESTEL vinculado a este proyecto. Si continúas, se creará un análisis nuevo que lo reemplazará, y los motores M2-M5 se regenerarán."
      : "Esto reemplazará tu análisis express actual por el de Centinela PESTEL, y los motores M2-M5 se regenerarán. ¿Continuar?";

  const confirmLabel = source === "relink" ? "Restaurar" : "Reemplazar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black-eske/50">
      <div className="bg-white-eske dark:bg-[#18324A] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-black-eske dark:text-[#EAF2F8]">{title}</h2>
            <p className="text-sm text-black-eske-10 dark:text-[#C7D6E0] mt-1">{body}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 py-2.5 bg-gray-eske-20 dark:bg-white/10 text-black-eske dark:text-[#EAF2F8] rounded-lg text-sm font-medium hover:bg-gray-eske-30 dark:hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 py-2.5 bg-orange-eske text-white-eske rounded-lg text-sm font-medium hover:bg-orange-eske/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isConfirming && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
