// app/api/moddulo/f2/finalize-dvs/route.ts
// POST { projectId, draftDVS?, confirmar?, huella? }
// Promueve el draftDVS al dvs final, limpia el borrador y motorAprobaciones.
// Con un dvs ya finalizado (H15 / M8, commit 3): si el dvs nuevo ELIMINA ids de
// preguntas o actores que la Fase 3 usa, responde 409 hasta que el usuario
// confirme; con ids conservados no hay candado (comportamiento previo).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { DVSF2 } from "@/types/moddulo.types";
import { reemplazarDVSConVersion } from "@/lib/moddulo/dvsVersiones";
import { diffIdsDVS, resumenEliminados, type IdsEliminados } from "@/lib/moddulo/diffIdsDVS";
import {
  ReemplazoRechazadoError,
  calcularImpactoReemplazoDVS,
  decidirCandadoReemplazo,
  lineasDeImpactoEdicion,
  type EstadoParaImpacto,
} from "@/lib/moddulo/impactoReemplazoDVS";
import { estadoParaImpactoDesdeProyecto, leerEstadoParaImpacto } from "@/lib/moddulo/impactoReemplazoServidor";
import { respuestaCandado } from "@/lib/moddulo/respuestaCandado";

/** Impact of replacing `estado.dvs` with `nuevo`: only the REMOVED ids count. */
function evaluar(estado: EstadoParaImpacto, nuevo: DVSF2) {
  const eliminados: IdsEliminados = diffIdsDVS(estado.dvs, nuevo);
  const decision = calcularImpactoReemplazoDVS(estado, {
    idsPipEliminados: eliminados.pip.map((p) => p.id),
    idsActorEliminados: eliminados.actores.map((a) => a.id),
  });
  return { eliminados, decision };
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { projectId?: string; draftDVS?: DVSF2; confirmar?: boolean; huella?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, draftDVS: clientDraft, confirmar, huella } = body;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await getProject(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Use client-side draft (which may have edits) or fall back to Firestore-stored draft
  const storedDraft = project.phases?.exploracion?.draftDVS as DVSF2 | undefined;
  const dvs = clientDraft ?? storedDraft;
  if (!dvs) {
    return NextResponse.json({ error: "No hay draftDVS para finalizar" }, { status: 400 });
  }

  // Defensivo: un draft en memoria del cliente puede venir de una pestaña
  // abierta desde antes de que pipItemId existiera (o de una edición manual
  // vía M5Panel de un ítem ya persistido sin el campo) — nunca persistir un
  // PIPItem sin identidad estable. Mismo criterio que normalizePIPItem() en
  // lib/moddulo/project.ts (determinístico, no aleatorio, para que un
  // pipItemId legado siga correlacionando con TareaPIP legado por numero).
  if (Array.isArray(dvs.pip)) {
    dvs.pip = dvs.pip.map((p) => ({ ...p, pipItemId: p.pipItemId ?? `legacy-${p.numero}` }));
  }

  // ── Lock, step 1 (before writing anything). Reads the RAW document (not
  // getProject()) so the fingerprint is computed from the same shape as in the
  // transaction. A failure here happens before any write: the previous analysis
  // is certainly untouched.
  let huellaConfirmada: string | null = null;
  try {
    const estado = await leerEstadoParaImpacto(adminDb, projectId);
    if (estado.dvs) {
      const { eliminados, decision } = evaluar(estado, dvs);
      const candado = decidirCandadoReemplazo({ decision, confirmar: confirmar === true, huellaRecibida: huella });
      if (candado.accion !== "continuar") {
        return respuestaCandado(candado.accion, candado.decision, {
          lineas: lineasDeImpactoEdicion(candado.decision),
          eliminados: resumenEliminados(eliminados),
        });
      }
      huellaConfirmada = huella ?? null;
    }
  } catch (err) {
    console.error("[finalize-dvs] no se pudo evaluar el impacto antes de guardar:", err);
    return NextResponse.json(
      {
        error: "finalize_fallo_previo",
        mensaje: "No se pudo guardar el análisis. El análisis anterior sigue vigente.",
      },
      { status: 500 }
    );
  }

  // If a finalized dvs already exists and the new one differs, it is copied to
  // dvsVersiones in the same transaction (a failed copy aborts the overwrite).
  // The first finalization has no previous dvs, so no copy is made.
  // Lock, step 2: the same check INSIDE the transaction, recomputing the diff
  // against the dvs read there (another tab may have saved since step 1).
  let eliminadosTardios: IdsEliminados | null = null;
  try {
    await reemplazarDVSConVersion(adminDb, projectId, {
      nuevoDvs: dvs,
      updates: {
        "phases.exploracion.estado": "lista",
        "phases.exploracion.draftDVS": FieldValue.delete(),
        "phases.exploracion.motorAprobaciones": FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      origen: "finalize-dvs",
      uid: session.uid,
      guardia: ({ proyecto, resultados }) => {
        const estado = estadoParaImpactoDesdeProyecto(proyecto, resultados);
        if (!estado.dvs) return; // first finalization
        const { eliminados, decision } = evaluar(estado, dvs);
        const candado = decidirCandadoReemplazo({
          decision,
          confirmar: huellaConfirmada !== null,
          huellaRecibida: huellaConfirmada,
        });
        if (candado.accion !== "continuar") {
          eliminadosTardios = eliminados;
          throw new ReemplazoRechazadoError(candado.accion, candado.decision);
        }
      },
    });
  } catch (err) {
    if (err instanceof ReemplazoRechazadoError) {
      // Nothing was written: the state changed since the user confirmed.
      return respuestaCandado(err.accion, err.decision, {
        lineas: lineasDeImpactoEdicion(err.decision),
        ...(eliminadosTardios ? { eliminados: resumenEliminados(eliminadosTardios) } : {}),
      });
    }
    // Whether the commit reached the server is unknown, so this does NOT claim
    // the previous analysis is untouched.
    console.error("[finalize-dvs] no se pudo confirmar el guardado del análisis:", err);
    return NextResponse.json(
      {
        error: "reemplazo_escritura_incierta",
        mensaje: "No se pudo confirmar el guardado del análisis. Recarga la página para verificar el estado.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ dvs }, { status: 200 });
}
