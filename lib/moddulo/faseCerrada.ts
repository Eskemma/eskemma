// lib/moddulo/faseCerrada.ts
// F2 closed (`phases.exploracion.status === "completed"`) = read-only. Every M1 writer answers the same
// 409 `fase_cerrada` as m1-edit / m1-approve / m1-reopen: same code, same body.
import { NextResponse } from "next/server";

export function exploracionCerrada(exp: { status?: unknown } | undefined | null): boolean {
  return exp?.status === "completed";
}

export function respuestaFaseCerrada(): NextResponse {
  return NextResponse.json({ error: "fase_cerrada" }, { status: 409 });
}
