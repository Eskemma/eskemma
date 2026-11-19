// app/api/moddulo/projects/[projectId]/historial/route.ts
// C4a-1 — GET: lector del historial unificado de UNA fase. SOLO LECTURA: no escribe nada (ni `lastAccessedAt`) y no
// llama a ningún modelo.
//   GET ?fase=<proposito|exploracion|investigacion>&limite=<1-50, def. 20>&cursor=<revisionN>&deriva=<0|1>
// Respuestas: 200 `RespuestaHistorial`; 400 parámetro inválido / fase sin historial; 401; 403 sin permiso de ver; 404
// (inexistente, en papelera o no colaborador: el MISMO mensaje); 503 `indice_en_construccion`; 500 `historial_ilegible`
// o genérico. Cualquier colaborador (también `client`) puede leer: la visibilidad vive en `visibilidadHistorial.ts`.

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { LIMITE_MAXIMO, LIMITE_POR_DEFECTO, esFaseConHistorial } from "@/lib/versionado/lectura";
import { HistorialIlegibleError, IndiceNoListoError, leerHistorialFase } from "@/lib/moddulo/versionado/leerHistorial";

const entero = (v: string | null): number | null | undefined => {
  if (v === null) return undefined; // ausente
  if (!/^\d{1,9}$/.test(v)) return null; // presente pero inválido
  return Number(v);
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { projectId } = await params;
  const q = new URL(request.url).searchParams;

  const fase = q.get("fase");
  if (!esFaseConHistorial(fase)) {
    return NextResponse.json({ error: "fase_sin_historial" }, { status: 400 });
  }
  const limiteCrudo = entero(q.get("limite"));
  const cursorCrudo = entero(q.get("cursor"));
  if (limiteCrudo === null || cursorCrudo === null) {
    return NextResponse.json({ error: "parametro_invalido" }, { status: 400 });
  }
  const limite = limiteCrudo === undefined ? LIMITE_POR_DEFECTO : limiteCrudo;
  if (limite < 1 || limite > LIMITE_MAXIMO || (cursorCrudo !== undefined && cursorCrudo < 1)) {
    return NextResponse.json({ error: "parametro_invalido" }, { status: 400 });
  }

  try {
    const r = await leerHistorialFase(adminDb, {
      proyectoId: projectId,
      uid: session.uid,
      fase,
      limite,
      ...(cursorCrudo !== undefined ? { cursor: cursorCrudo } : {}),
      conDeriva: q.get("deriva") === "1",
    });
    const sinCache = { headers: { "Cache-Control": "no-store" } };
    if (r.tipo === "no_encontrado") return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    if (r.tipo === "sin_permiso") return NextResponse.json({ error: "sin_permiso" }, { status: 403 });
    return NextResponse.json(r.respuesta, sinCache);
  } catch (err) {
    if (err instanceof IndiceNoListoError) {
      return NextResponse.json({ error: "indice_en_construccion" }, { status: 503 });
    }
    if (err instanceof HistorialIlegibleError) {
      console.error("[historial] historial ilegible:", { projectId, fase, causa: err.message });
      return NextResponse.json({ error: "historial_ilegible" }, { status: 500 });
    }
    console.error("[historial] error de lectura:", { projectId, fase, clase: (err as Error)?.name });
    return NextResponse.json({ error: "Error al leer el historial" }, { status: 500 });
  }
}
