// app/components/centinela/pestel/monitoreo/CrisisBanner.tsx
// Shown when there is at least one unread crisis alert.

"use client";

import { useRouter } from "next/navigation";
import type { PESTELAlertV2 } from "@/types/pestel.types";

interface Props {
  alerts: PESTELAlertV2[];
  projectId: string;
}

export default function CrisisBanner({ alerts, projectId }: Props) {
  const router = useRouter();
  const hasCrisis = alerts.some((a) => a.isCrisis && !a.readAt);

  if (!hasCrisis) return null;

  return (
    <div
      className="bg-red-eske text-white rounded-xl px-5 py-4 flex items-center
        justify-between gap-4"
      role="alert"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0" aria-hidden="true">
          ⚠️
        </span>
        <div>
          <p className="font-semibold text-sm">Alerta de crisis detectada</p>
          <p className="text-xs text-white/80 mt-0.5">
            Se ha identificado un cambio crítico en el entorno del proyecto.
            Revisa los detalles en el feed de alertas.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          router.push(`/centinela/pestel/${projectId}/analisis`)
        }
        className="shrink-0 px-4 py-2 bg-white text-red-eske text-sm font-semibold
          rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
      >
        Ver análisis →
      </button>
    </div>
  );
}
