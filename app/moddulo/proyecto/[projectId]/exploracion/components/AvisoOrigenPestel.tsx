// T4: aviso de que el análisis de Centinela importado ya no está al día. Solo informa y manda a Centinela.
// Describe un estado del proyecto: NO se puede descartar; desaparece cuando el usuario actualiza el análisis.
// Colores como las demás franjas de aviso (marrón en claro, amarillo en oscuro).
import Link from "next/link";
import type { AvisoOrigen } from "@/lib/moddulo/avisoOrigen";

export function AvisoOrigenPestel({ aviso, pestProjectId }: { aviso: AvisoOrigen; pestProjectId?: string | null }) {
  if (aviso.tipo === "ninguno") return null;
  return (
    <div
      role="status"
      className="shrink-0 mb-3 border border-brown-eske-60/50 dark:border-yellow-eske/30 bg-brown-eske-60/10 dark:bg-yellow-eske/10 text-brown-eske-80 dark:text-yellow-eske text-sm px-4 py-2.5 rounded-lg flex items-start justify-between gap-3"
    >
      <p className="min-w-0">
        {aviso.texto}
        {pestProjectId && (
          <>
            {" "}
            <Link href={`/centinela/pestel/${pestProjectId}/analisis`} className="font-medium underline underline-offset-2 whitespace-nowrap focus-visible:outline focus-visible:outline-2">
              Ver en Centinela →
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
