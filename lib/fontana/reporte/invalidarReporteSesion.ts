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

export async function invalidarReporteSesion(
  sesionRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  await sesionRef.update({ reporteSesion: FieldValue.delete() });
  // delete() es idempotente si el doc no existe. También el doc de job
  // (estado de la generación asíncrona) — al invalidar, cualquier job
  // previo deja de ser relevante.
  await Promise.all([
    sesionRef.collection("reporte").doc("actual").delete(),
    sesionRef.collection("reporte").doc("job").delete(),
  ]);
}
