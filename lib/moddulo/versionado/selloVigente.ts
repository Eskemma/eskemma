// lib/moddulo/versionado/selloVigente.ts
// SERVER-ONLY. C3b — «desde cuándo está aprobado» un resultado, leído del HISTORIAL (el sello vive solo en la
// versión, nunca en el documento vivo; §6). Se usa SOLO en el camino que pregunta (409): 2 lecturas, 0 escrituras.
//
// Regla: el valor sale de `aprobacion.en` de la versión VIGENTE según el manifiesto de la revisión vigente, y
// SOLO si esa versión trae `aprobado: true`. Si la versión vigente no tiene aprobación, o falta el puntero, el
// manifiesto o la versión, o hay inconsistencia, devuelve `null` («sin autoría registrada»). Nunca se usa la marca
// de escritura de una versión sin aprobación. Nunca lanza.

import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { idRevision } from "@/lib/versionado/registrar";
import { FASE_F3, PUNTERO_F3 } from "./artefactosF3";

function leerRuta(obj: unknown, ruta: string): unknown {
  let actual: unknown = obj;
  for (const parte of ruta.split(".")) {
    if (actual === null || typeof actual !== "object") return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

export async function leerSelloVigente(
  tx: Transaction,
  raiz: DocumentReference,
  datosRaiz: Record<string, unknown> | undefined,
  artefacto: string
): Promise<string | null> {
  try {
    const puntero = leerRuta(datosRaiz, PUNTERO_F3) as { n?: unknown } | undefined;
    if (!puntero || typeof puntero.n !== "number" || !Number.isInteger(puntero.n) || puntero.n < 1) return null;

    const revision = await tx.get(raiz.collection("revisiones").doc(idRevision(FASE_F3, puntero.n)));
    if (!revision.exists) return null;
    const manifiesto = revision.data() as { n?: unknown; fase?: unknown; artefactos?: Record<string, { versionId?: unknown }> };
    if (manifiesto.n !== puntero.n || manifiesto.fase !== FASE_F3) return null;
    const versionId = manifiesto.artefactos?.[artefacto]?.versionId;
    if (typeof versionId !== "string" || !versionId) return null;

    const version = await tx.get(raiz.collection("versiones").doc(versionId));
    if (!version.exists) return null;
    const aprobacion = (version.data() as { aprobacion?: { aprobado?: unknown; en?: unknown } } | undefined)?.aprobacion;
    if (!aprobacion || aprobacion.aprobado !== true) return null;
    return typeof aprobacion.en === "string" && aprobacion.en ? aprobacion.en : null;
  } catch {
    return null;
  }
}
