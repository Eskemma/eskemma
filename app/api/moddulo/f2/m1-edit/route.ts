// app/api/moddulo/f2/m1-edit/route.ts
// POST { projectId, dim, texto?, clasificacion?, restaurar?, base: { narrativa, clasificacion } }
// Saves the user's edit of ONE dimension of the M1 (narrativa and/or clasificacion) or restores the
// AI's original of both. Payload and m1.ediciones are written together in ONE transaction that
// re-reads the document and validates the state; nothing calls this yet (the screen comes later).
//
// 409 codes (nothing written): m1_aprobado (valid approval: locked), m1_cambio (`base` is not what
// is stored: another tab edited it), m1_no_editable_centinela (M1 of Centinela: the pencil is
// Express only), fase_cerrada (F2 is closed / read-only). A 5xx is ambiguous for the client.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { M1Datos, MapaPESTEL } from "@/types/moddulo.types";
import {
  CLASIFICACIONES_M1,
  dimensionEditada,
  registrarEdicion,
  restaurarDimension,
} from "@/lib/moddulo/m1Aprobacion";
import { huellaMapaPESTEL } from "@/lib/moddulo/m1Huella";
import { analizarM1 } from "@/lib/moddulo/m1Servidor";

export const MAX_TEXTO_M1 = 10_000; // real maximum measured: 3,839 characters

const DIMENSIONES = ["P", "E", "S", "T", "Ec", "L"];

type Resultado =
  | { t: "no_encontrado" }
  | { t: "m1_no_encontrado" }
  | { t: "fase_cerrada" }
  | { t: "centinela" }
  | { t: "aprobado" }
  | { t: "dimension" }
  | { t: "cambio" }
  | { t: "ok"; narrativa: string; clasificacion: string; editada: boolean; huella: string; sinCambios: boolean };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: {
    projectId?: unknown; dim?: unknown; texto?: unknown; clasificacion?: unknown; restaurar?: unknown;
    base?: { narrativa?: unknown; clasificacion?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return bad("JSON inválido");
  }

  const { projectId, dim, texto, clasificacion, restaurar, base } = body;
  if (typeof projectId !== "string" || !projectId) return bad("projectId es requerido");
  if (typeof dim !== "string" || !DIMENSIONES.includes(dim)) return bad("dim inválida");
  if (typeof base?.narrativa !== "string" || typeof base?.clasificacion !== "string") return bad("base es requerida");

  const quiereRestaurar = restaurar === true;
  let textoNuevo: string | undefined;
  if (!quiereRestaurar) {
    if (texto === undefined && clasificacion === undefined) return bad("Nada que guardar");
    if (texto !== undefined) {
      if (typeof texto !== "string" || texto.trim().length === 0 || texto.length > MAX_TEXTO_M1) return bad("texto_invalido");
      textoNuevo = texto.trim();
    }
    if (clasificacion !== undefined && !(CLASIFICACIONES_M1 as readonly unknown[]).includes(clasificacion)) {
      return bad("clasificacion_invalida");
    }
  }

  // Access only (collaborator, not in the trash); the state that counts is re-read in the transaction.
  const project = await getProject(projectId, session.uid);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const ref = adminDb.collection("moddulo_projects").doc(projectId);
  // The callback may be retried: it reads before writing, has no outside effect and returns a result.
  const r = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.deletedAt) return { t: "no_encontrado" };
    const a = analizarM1(snap.data()?.phases?.exploracion);
    if (a.cerrada) return { t: "fase_cerrada" };
    if (!a.payload) return { t: "m1_no_encontrado" };
    if (a.kind === "T22") return { t: "centinela" };
    if (a.estado.aprobacionValida) return { t: "aprobado" };
    const d = a.payload[dim];
    if (!d) return { t: "dimension" };

    const narrAct = d.narrativa ?? "";
    const clasAct = d.clasificacion as string;
    if (base.narrativa !== narrAct || base.clasificacion !== clasAct) return { t: "cambio" };

    const m1 = a.m1 as M1Datos | undefined;
    let ediciones = m1?.ediciones;
    let narrNueva = narrAct;
    let clasNueva = clasAct;

    if (quiereRestaurar) {
      const rest = restaurarDimension(ediciones, dim);
      if (Object.keys(rest.valores).length === 0) {
        return { t: "ok", narrativa: narrAct, clasificacion: clasAct, editada: false, huella: a.huellaPayload!, sinCambios: true };
      }
      ediciones = rest.ediciones;
      narrNueva = rest.valores.narrativa ?? narrAct;
      clasNueva = rest.valores.clasificacion ?? clasAct;
    } else {
      const en = FieldValue.serverTimestamp();
      if (textoNuevo !== undefined && textoNuevo !== narrAct) {
        ediciones = registrarEdicion(ediciones, { dim, campo: "narrativa", valorActual: narrAct, editado: textoNuevo, por: session.uid, en });
        narrNueva = textoNuevo;
      }
      if (typeof clasificacion === "string" && clasificacion !== clasAct) {
        ediciones = registrarEdicion(ediciones, { dim, campo: "clasificacion", valorActual: clasAct, editado: clasificacion, por: session.uid, en });
        clasNueva = clasificacion;
      }
      if (narrNueva === narrAct && clasNueva === clasAct) {
        return { t: "ok", narrativa: narrAct, clasificacion: clasAct, editada: dimensionEditada(m1?.ediciones, a.payload, dim), huella: a.huellaPayload!, sinCambios: true };
      }
    }

    const nuevoMapa = structuredClone(a.payload) as MapaPESTEL;
    nuevoMapa[dim]!.narrativa = narrNueva;
    nuevoMapa[dim]!.clasificacion = clasNueva as never;

    const updates: Record<string, unknown> = {
      // The whole map is written (its keys contain a dot: "P.narrativa" would be read as a path).
      "phases.exploracion.m1.ediciones": ediciones ?? {},
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (narrNueva !== narrAct) updates[`phases.exploracion.linkedSource.payload.${dim}.narrativa`] = narrNueva;
    if (clasNueva !== clasAct) updates[`phases.exploracion.linkedSource.payload.${dim}.clasificacion`] = clasNueva;
    tx.update(ref, updates);

    return {
      t: "ok", narrativa: narrNueva, clasificacion: clasNueva,
      editada: dimensionEditada(ediciones, nuevoMapa, dim),
      huella: huellaMapaPESTEL(nuevoMapa), sinCambios: false,
    };
  });

  switch (r.t) {
    case "no_encontrado": return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    case "m1_no_encontrado": return NextResponse.json({ error: "m1_no_encontrado" }, { status: 404 });
    case "dimension": return NextResponse.json({ error: "dimension_no_encontrada" }, { status: 404 });
    case "fase_cerrada": return NextResponse.json({ error: "fase_cerrada" }, { status: 409 });
    case "centinela": return NextResponse.json({ error: "m1_no_editable_centinela" }, { status: 409 });
    case "aprobado": return NextResponse.json({ error: "m1_aprobado" }, { status: 409 });
    case "cambio": return NextResponse.json({ error: "m1_cambio" }, { status: 409 });
    case "ok":
      return NextResponse.json({
        ok: true, dim, narrativa: r.narrativa, clasificacion: r.clasificacion,
        editada: r.editada, huella: r.huella, ...(r.sinCambios ? { sinCambios: true } : {}),
      });
  }
}
