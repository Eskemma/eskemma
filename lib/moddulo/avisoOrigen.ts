// lib/moddulo/avisoOrigen.ts
// T4: ¿F2 debe avisar que el análisis de Centinela que importó ya no está al día? Decisión pura (como
// `avisoXpcto.ts`). Solo informa: la acción es ir a Centinela y regresar a F2 (el botón con la versión exacta es T7).
//
//  - nada si la Fase 2 está cerrada (no se puede importar: contención provisional hasta el Bloque 4),
//  - nada si no se pudo verificar (importaciones anteriores a T4, origen ajeno o ilegible: nunca se dice «cambió»),
//  - «versión más nueva» o «el análisis cambió» según el estado.

import type { ResultadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";

export type AvisoOrigen =
  | { tipo: "ninguno" }
  | { tipo: "version_nueva"; texto: string }
  | { tipo: "cambio_contenido"; texto: string };

const ACCION = "Para actualizar, abre Centinela y regresa a Moddulo F2.";

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
  return { tipo: "ninguno" };
}
