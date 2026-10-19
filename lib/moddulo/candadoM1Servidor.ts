// lib/moddulo/candadoM1Servidor.ts
// SERVER-ONLY (fingerprint → node:crypto). The H15 confirmation lock of the routes that REPLACE or REMOVE
// the reviewed M1 (generate-m1-express «Nuevo análisis», import-pestel and link-moddulo «vincular»,
// unlink-pestel «desvincular»). It is the same lock m1-reopen applies: the lines and the fingerprint are
// computed from the REAL state of the project document; without `confirmar` + `huella`, or with a stale
// `huella`, the route answers 409 and writes nothing.
//
// The routes call it twice: once before the costly work (so the 409 costs nothing) and once INSIDE the
// final transaction, against the fingerprint the user confirmed (the state may have changed meanwhile).

import { NextResponse } from "next/server";
import { analizarM1, type ExploracionParaM1 } from "./m1Servidor";
import { huellaTexto } from "./m1Huella";
import {
  decidirCandadoM1,
  firmaImpactoM1,
  lineasImpactoM1,
  requiereConfirmacionM1,
  type AccionM1,
} from "./impactoM1";

export type DecisionCandadoM1Servidor =
  | { accion: "continuar" }
  | { accion: "requiere_confirmacion" | "huella_vencida"; lineas: string[]; huella: string };

export function decidirCandadoM1Servidor(
  exp: ExploracionParaM1 | undefined,
  accion: Exclude<AccionM1, "reabrir">,
  c: { confirmar: unknown; huella: unknown; /** unlink-pestel: asks even on a clean project. */ siempre?: boolean }
): DecisionCandadoM1Servidor {
  const a = analizarM1(exp);
  const huellaActual = huellaTexto(firmaImpactoM1(a.impacto, accion));
  const decision = decidirCandadoM1({
    requiere: c.siempre === true || requiereConfirmacionM1(a.impacto, accion),
    huellaActual,
    confirmar: c.confirmar === true,
    huellaRecibida: typeof c.huella === "string" ? c.huella : null,
  });
  if (decision === "continuar") return { accion: "continuar" };
  return { accion: decision, lineas: lineasImpactoM1(a.impacto, accion), huella: huellaActual };
}

/** The 409 of the lock: same codes and shape as m1-reopen. Nothing was written. */
export function respuestaCandadoM1(d: Exclude<DecisionCandadoM1Servidor, { accion: "continuar" }>): NextResponse {
  return NextResponse.json(
    {
      error: d.accion === "huella_vencida" ? "reemplazo_huella_vencida" : "reemplazo_requiere_confirmacion",
      lineas: d.lineas,
      huella: d.huella,
    },
    { status: 409 }
  );
}
