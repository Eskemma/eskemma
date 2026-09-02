// lib/fontana/agente/adjuntosContexto.ts
// Construye el bloque de contexto con el texto de los archivos que el
// usuario adjuntó a la sesión de Fontana. Se antepone al contenido del
// turno de usuario en app/api/fontana/chat/route.ts. NO es una herramienta
// ni una fuente del registry — es contexto crudo (ver el bloque
// "## Archivos adjuntos por el usuario" del system prompt).

import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

// Presupuesto total del bloque, en caracteres. ~16 K tokens en español.
// Ajustable: sube el coste por turno (el bloque se re-inyecta en cada
// mensaje) sin acercarse a saturar la ventana de 200 K de Claude Sonnet 4.6
// ni siquiera en conversaciones largas con historial y tool_results.
export const PRESUPUESTO_ADJUNTOS_CHARS = 60_000;

interface AdjuntoDoc {
  id: string;
  nombreArchivo: string;
  textoExtraido: string;
  cargadoEn?: Timestamp;
}

/**
 * Lee fontana_sesiones/{sesionId}/adjuntos y arma el bloque de contexto.
 * Orden de llenado del presupuesto:
 *  1. los adjuntos referenciados en ESTE turno (idsDelTurno), completos —
 *     el documento recién adjuntado nunca se recorta salvo que él solo
 *     exceda el presupuesto;
 *  2. el resto de adjuntos de la sesión, más recientes primero, hasta
 *     agotar el presupuesto;
 *  3. aviso de cuántos quedaron fuera.
 * Devuelve "" si la sesión no tiene adjuntos.
 */
export async function construirBloqueAdjuntos(
  sesionId: string,
  idsDelTurno: string[]
): Promise<string> {
  const snap = await adminDb
    .collection("fontana_sesiones")
    .doc(sesionId)
    .collection("adjuntos")
    .get();
  if (snap.empty) return "";

  const docs = snap.docs.map((d) => d.data() as AdjuntoDoc);
  const delTurnoSet = new Set(idsDelTurno);

  const delTurno = docs
    .filter((d) => delTurnoSet.has(d.id))
    .sort((a, b) => ms(a.cargadoEn) - ms(b.cargadoEn));
  const resto = docs
    .filter((d) => !delTurnoSet.has(d.id))
    .sort((a, b) => ms(b.cargadoEn) - ms(a.cargadoEn));

  let restante = PRESUPUESTO_ADJUNTOS_CHARS;
  const secciones: string[] = [];
  let omitidos = 0;

  const agregar = (d: AdjuntoDoc, prioritario: boolean) => {
    if (restante <= 0) {
      omitidos++;
      return;
    }
    const encabezado = `### ${d.nombreArchivo}\n`;
    const cuerpoMax = restante - encabezado.length;
    if (cuerpoMax <= 0) {
      omitidos++;
      return;
    }
    let cuerpo = d.textoExtraido;
    if (cuerpo.length > cuerpoMax) {
      cuerpo = cuerpo.slice(0, cuerpoMax) + "\n(documento truncado)";
      if (!prioritario) omitidos++; // se cortó por falta de presupuesto
    }
    secciones.push(encabezado + cuerpo);
    restante -= encabezado.length + cuerpo.length;
  };

  for (const d of delTurno) agregar(d, true);
  for (const d of resto) agregar(d, false);

  if (secciones.length === 0) return "";

  const aviso =
    omitidos > 0
      ? `\n\n(${omitidos} documento(s) adjunto(s) más antiguo(s) no caben en el contexto; el usuario puede volver a adjuntarlos si los necesita.)`
      : "";

  return (
    "## Documentos adjuntos por el usuario en esta sesión\n\n" +
    secciones.join("\n\n") +
    aviso
  );
}

function ms(t?: Timestamp): number {
  return t && typeof t.toMillis === "function" ? t.toMillis() : 0;
}
