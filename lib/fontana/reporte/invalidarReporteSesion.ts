// lib/fontana/reporte/invalidarReporteSesion.ts
// Deja una sesión de Fontana SIN reporte: borra el puntero ligero
// `reporteSesion` del doc de sesión y el doc de cuerpo
// fontana_sesiones/{id}/reporte/actual. Fuente única de este par de
// operaciones — la usan:
//   - repuntarSiCorresponde (sesion/route.ts): al cambiar de tarea PIP
//     cambia el conjunto de indicadores heredados, el reporte queda obsoleto.
//   - DELETE /api/fontana/sesion/[id]/reporte: "Eliminar reporte" desde la
//     pestaña Reporte.
//
// NO toca Storage: un .md ya subido para una entrega a Moddulo es un
// artefacto histórico de esa entrega (referenciado por
// f3Resultados/{id}.payload.reporteInterpretativoUrl) — mismo criterio que
// los .md huérfanos de reentrega. Solo se elimina el documento vivo del
// lado de Fontana.

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Las tres operaciones (puntero + `reporte/actual` + `reporte/job`) salen en UN WriteBatch: o se
 * aplican todas o ninguna (7b-1, H25). Sin `batch` crea el suyo y lo confirma; con `batch` solo
 * AGREGA sus operaciones y NO confirma — quien lo pasó lo confirma junto con las suyas
 * (`repuntarSiCorresponde` suma aquí su propio `update` de la sesión: 4 operaciones atómicas).
 *
 * Diferencia con la versión anterior (update + 2 delete por separado): si el documento de la
 * sesión NO existe, el `update` hace fallar el batch completo y no se aplica ninguna operación.
 * Antes fallaba el `update` (primera operación) y los `delete` ni se intentaban, así que para
 * «Eliminar reporte» no cambia nada observable; en el repunte, la sesión ya se leyó en la misma
 * petición, de modo que solo difiere si otra petición la borró en medio (ahora: nada se aplica).
 */
export async function invalidarReporteSesion(
  sesionRef: FirebaseFirestore.DocumentReference,
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  const propio = batch === undefined;
  const lote = batch ?? adminDb.batch();
  lote.update(sesionRef, { reporteSesion: FieldValue.delete() });
  // delete() es idempotente si el doc no existe. También el doc de job
  // (estado de la generación asíncrona) — al invalidar, cualquier job
  // previo deja de ser relevante.
  lote.delete(sesionRef.collection("reporte").doc("actual"));
  lote.delete(sesionRef.collection("reporte").doc("job"));
  if (propio) await lote.commit();
}
