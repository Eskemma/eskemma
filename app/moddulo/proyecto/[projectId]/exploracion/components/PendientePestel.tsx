// T5: franja del vínculo PENDIENTE con Centinela (un proyecto PESTEL en preparación que aún no se importó). Informa,
// lleva a Centinela (si el proyecto existe) y permite cancelar el vínculo; con la Fase 2 cerrada la cancelación
// queda deshabilitada con su motivo (el servidor también la rechaza: 409 fase_cerrada).
import Link from "next/link";

export const TEXTO_PENDIENTE = "Análisis PESTEL en preparación en Centinela; aún no se importa.";
export const TEXTO_PENDIENTE_ARCHIVADO = "Análisis PESTEL en preparación en Centinela (el proyecto está archivado); aún no se importa.";
export const TEXTO_PENDIENTE_HUERFANO = "El proyecto de Centinela vinculado ya no existe; no hay nada que importar. Puedes cancelar el vínculo.";
export const TEXTO_PENDIENTE_CERRADA = "la fase está cerrada: no se puede importar ni cancelar.";
export const TOOLTIP_FASE_CERRADA = "La fase está cerrada";

export function PendientePestel({
  pestelId, etapa, archivado, huerfano, f2Cerrada, cancelando, onCancelar,
}: {
  pestelId: string;
  etapa: number | null;
  archivado: boolean;
  huerfano: boolean;
  f2Cerrada: boolean;
  cancelando: boolean;
  onCancelar: () => void;
}) {
  const texto = huerfano ? TEXTO_PENDIENTE_HUERFANO : archivado ? TEXTO_PENDIENTE_ARCHIVADO : TEXTO_PENDIENTE;
  const destino = `/centinela/pestel/${pestelId}/${etapa !== null && etapa >= 5 ? "analisis" : "datos"}`;
  return (
    <div
      role="status"
      className="shrink-0 px-3 py-2 border-b border-gray-eske-20 dark:border-white/10 bg-gray-eske-10 dark:bg-white/5 text-xs text-black-eske-40 dark:text-[#C7D6E0] flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <p className="min-w-0">
        {texto}
        {f2Cerrada && ` Pero ${TEXTO_PENDIENTE_CERRADA}`}
        {!huerfano && (
          <>
            {" "}
            <Link href={destino} className="font-medium text-bluegreen-eske dark:text-blue-eske-20 underline underline-offset-2 whitespace-nowrap focus-visible:outline focus-visible:outline-2">
              Ir a Centinela →
            </Link>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onCancelar}
        disabled={f2Cerrada || cancelando}
        title={f2Cerrada ? TOOLTIP_FASE_CERRADA : undefined}
        className="shrink-0 underline underline-offset-2 text-black-eske-20 dark:text-[#9AAEBE] disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2"
      >
        {cancelando ? "Cancelando…" : "Cancelar vínculo pendiente"}
      </button>
    </div>
  );
}
