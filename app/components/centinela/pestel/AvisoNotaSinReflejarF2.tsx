"use client";

// T7 C3b: «Moddulo F2 todavía no incluye la nota de aprobación…» encima del botón «Regresar a Moddulo F2 con resultados»
// (Análisis y Monitoreo). Reglas: nada visible mientras carga (sin parpadeo); si la lectura falla, silencio total y el
// botón sigue funcionando; solo se pregunta con proyecto vinculado y un análisis con nota (proyectos sin nota no leen nada).
import { useEffect, useState } from "react";
import { cargarNotaImportada, debePedirNotaImportada, mostrarAvisoNotaCentinela } from "@/lib/centinela/pestel/avisoNotaCentinela";
import { TEXTO_NOTA_SIN_REFLEJAR_F2, type AnalisisConNota, type NotaImportadaResumen } from "@/lib/centinela/pestel/notaAprobacion";

/** Presentación pura (probada con renderToStaticMarkup). */
export function AvisoNotaSinReflejarF2Vista({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="max-w-md text-xs leading-snug rounded-lg px-3 py-2 text-left border-l-4 border-y border-r border-brown-eske-60 dark:border-yellow-eske bg-brown-eske-60/10 dark:bg-yellow-eske/10 text-brown-eske-80 dark:text-yellow-eske"
    >
      {TEXTO_NOTA_SIN_REFLEJAR_F2}
    </div>
  );
}

export default function AvisoNotaSinReflejarF2({
  projectId,
  moddulo,
  analysis,
}: {
  projectId: string;
  /** `project.modduloProjectId` (ya cargado por la pantalla): sin vínculo no se pregunta nada. */
  moddulo?: string | null;
  analysis?: (AnalisisConNota & { id?: string }) | null;
}) {
  const [importada, setImportada] = useState<NotaImportadaResumen | null>(null);
  const pedir = debePedirNotaImportada({ moddulo, analysis });
  const analysisId = analysis?.id;
  const status = analysis?.status;
  useEffect(() => {
    if (!pedir) {
      setImportada(null);
      return;
    }
    let cancelado = false;
    void cargarNotaImportada(projectId).then((n) => {
      if (!cancelado) setImportada(n);
    });
    return () => {
      cancelado = true;
    };
  }, [projectId, pedir, analysisId, status]);
  return <AvisoNotaSinReflejarF2Vista visible={pedir && mostrarAvisoNotaCentinela(analysis, importada)} />;
}
