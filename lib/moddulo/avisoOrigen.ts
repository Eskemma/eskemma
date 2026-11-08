// lib/moddulo/avisoOrigen.ts
// T4: ¿F2 debe avisar que el análisis de Centinela que importó ya no está al día? Decisión pura (como
// `avisoXpcto.ts`). Solo informa: la acción es ir a Centinela y regresar a F2 (el botón con la versión exacta es T7).
//
//  - nada si la Fase 2 está cerrada (no se puede importar: contención provisional hasta el Bloque 4),
//  - nada si no se pudo verificar (importaciones anteriores a T4, origen ajeno o ilegible: nunca se dice «cambió»),
//  - «versión más nueva», «el análisis cambió» o «la nota de aprobación cambió» según el estado.

import type { ResultadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";

export type AvisoOrigen =
  | { tipo: "ninguno" }
  | { tipo: "version_nueva"; texto: string }
  | { tipo: "cambio_contenido"; texto: string }
  | { tipo: "cambio_nota"; texto: string };

// T7 C3: nombra el botón que existe en Centinela (con el proyecto vinculado) para volver a F2 con el análisis al día.
export const ACCION = "Para actualizar, abre Centinela y usa «Regresar a Moddulo F2 con resultados».";

function etiquetaVersion(version?: number, fecha?: string): string {
  const f = fecha ? new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  return [version != null ? `v${version}` : null, f].filter(Boolean).join(", ");
}

export function decidirAvisoOrigen(i: { origen: ResultadoOrigen | null | undefined; f2Cerrada: boolean }): AvisoOrigen {
  if (i.f2Cerrada || !i.origen) return { tipo: "ninguno" };
  const o = i.origen;
  if (o.estado === "version_nueva") {
    const nueva = etiquetaVersion(o.vigente?.version, o.vigente?.fecha);
    const actual = o.importada?.version != null ? `v${o.importada.version}` : "una versión anterior";
    return {
      tipo: "version_nueva",
      texto: `Hay una versión más nueva del análisis PESTEL${nueva ? ` (${nueva})` : ""}. Este proyecto usa ${actual}. ${ACCION}`,
    };
  }
  if (o.estado === "cambio_contenido") {
    const imp = o.importada?.version != null ? ` (v${o.importada.version})` : "";
    return {
      tipo: "cambio_contenido",
      texto: `El análisis PESTEL de origen${imp} cambió después de importarlo (por ejemplo, por un ajuste del analista). Lo que ves aquí es la versión importada. ${ACCION}`,
    };
  }
  if (o.estado === "cambio_nota") {
    // T7 C3b: tres textos según lo que pasó con la nota (agregada / cambiada / retirada). «versión N» (no «vN»): se
    // armoniza con los textos de T4 en C4+C5. Sin versión legible, se dice sin ella.
    const ver = o.importada?.version != null ? ` (versión ${o.importada.version})` : "";
    const texto =
      o.cambioNota === "agregada"
        ? `El análisis PESTEL de origen${ver} tiene ahora una nota de aprobación del analista (aprobado con confianza baja) que este proyecto no incluye. ${ACCION}`
        : o.cambioNota === "retirada"
        ? `La nota de aprobación del análisis PESTEL de origen${ver} se retiró después de importarlo. Lo que ves aquí es la nota importada, que ya no está vigente. ${ACCION}`
        : `La nota de aprobación del análisis PESTEL de origen${ver} cambió después de importarlo, por ejemplo al volver a aprobarlo con otra justificación. Lo que ves aquí es la nota importada. ${ACCION}`;
    return { tipo: "cambio_nota", texto };
  }
  return { tipo: "ninguno" };
}
