// lib/centinela/pestel/candadoOrigen.ts
// SERVER-ONLY (huella → node:crypto). T7 C2 — el gate de origen de H-P1: confirma, no bloquea. Sigue el patrón
// del candado H15 (`candadoM1Servidor`): la MISMA función decide fuera de la transacción (para que el 409 no
// cueste nada) y dentro (contra el estado releído). La huella de «lo mostrado» (las razones con sus datos) la
// calcula y la compara SOLO el servidor; el cliente devuelve un valor opaco y no calcula huellas.
//
//  - sin razones que pidan confirmación (nivel «ok»; la confianza baja sola solo informa) → continuar;
//  - con `confirmarOrigen === true` y la huella igual a la actual → continuar;
//  - con `confirmarOrigen === true` y huella distinta o ausente → `huella_vencida` (se muestra lo nuevo);
//  - si no → `requiere_confirmacion`.
//
// Orden de rechazos de las rutas: fase cerrada → candado H15 → gate de origen.

import { NextResponse } from "next/server";
import type { Firestore, Query, QuerySnapshot } from "firebase-admin/firestore";
import { huellaTexto } from "@/lib/moddulo/m1Huella";
import { serializacionEstable } from "@/lib/moddulo/serializacionEstable";
import { decidirImportabilidad, type AnalisisParaGate, type RazonImportabilidad, type VigenteParaGate } from "./importabilidad";
import { elegirUltimoAnalisis } from "./ultimoAnalisis";

export type DecisionCandadoOrigen =
  | { accion: "continuar"; razones: RazonImportabilidad[] }
  | { accion: "requiere_confirmacion" | "huella_vencida"; razones: RazonImportabilidad[]; huella: string };

/** sha-256 de las razones tal como se muestran (con sus datos); el cliente solo la devuelve, opaca. */
export function huellaDeRazonesOrigen(razones: readonly RazonImportabilidad[]): string {
  return huellaTexto(serializacionEstable(razones));
}

export function decidirCandadoOrigen(
  analysis: AnalisisParaGate,
  vigente: VigenteParaGate | null | undefined,
  c: { confirmarOrigen: unknown; huellaOrigen: unknown }
): DecisionCandadoOrigen {
  const { nivel, razones } = decidirImportabilidad(analysis, vigente);
  if (nivel === "ok") return { accion: "continuar", razones };
  const huella = huellaDeRazonesOrigen(razones);
  if (c.confirmarOrigen === true) {
    if (typeof c.huellaOrigen === "string" && c.huellaOrigen === huella) return { accion: "continuar", razones };
    return { accion: "huella_vencida", razones, huella };
  }
  return { accion: "requiere_confirmacion", razones, huella };
}

/**
 * Lee el análisis vigente SOLO si hace falta para la fecha de la razón `no_vigente` (el análisis tiene
 * `vigente === false`). Costo: 0 lecturas en el caso normal, 1 consulta cuando aplica. `ejecutar` es
 * `(q) => q.get()` fuera de la transacción y `(q) => tx.get(q)` dentro. Si la consulta falla o no hay
 * vigente, devuelve null (la razón se dice sin esa fecha; no se inventa).
 */
export async function leerVigenteParaGate(
  ejecutar: (q: Query) => Promise<QuerySnapshot>,
  db: Firestore,
  analysis: { projectId?: unknown; vigente?: unknown },
  { tolerarFallo }: { tolerarFallo: boolean }
): Promise<VigenteParaGate | null> {
  if (analysis.vigente !== false || typeof analysis.projectId !== "string") return null;
  try {
    const snap = await ejecutar(db.collection("pestel_analyses").where("projectId", "==", analysis.projectId).where("vigente", "==", true));
    const elegido = elegirUltimoAnalisis(snap.docs, (d) => d.data());
    return elegido ? { id: elegido.id, analyzedAt: elegido.data().analyzedAt } : null;
  } catch (err) {
    if (!tolerarFallo) throw err;
    console.error("[candadoOrigen] no se pudo consultar el análisis vigente:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** El 409 del gate. Nada se escribió. `lineas: []` dice a la pantalla que no hay nada que perder por H15. */
export function respuestaCandadoOrigen(d: Exclude<DecisionCandadoOrigen, { accion: "continuar" }>): NextResponse {
  return NextResponse.json(
    {
      error: d.accion === "huella_vencida" ? "origen_huella_vencida" : "origen_requiere_confirmacion",
      razones: d.razones,
      huella: d.huella,
      lineas: [],
    },
    { status: 409 }
  );
}
