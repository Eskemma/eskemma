// app/api/moddulo/f2/find-linked-pestel/route.ts
// GET ?moddulo_project_id=X  — find pestel_projects by modduloProjectId (fallback path)
// GET ?pestel_project_id=Y   — fetch fresh currentStage by direct ID (happy path)
//   + &moddulo_project_id=X&verificar=1 (T4) — además `origen`: ¿el análisis importado sigue al día?

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";
import { clasificarAsimetrias } from "@/lib/centinela/pestel/asimetriasVinculo";
import { verificarOrigen } from "@/lib/centinela/pestel/verificarOrigen";
import type { ResultadoOrigen } from "@/lib/centinela/pestel/estadoOrigen";
import { calcularSalida, type SalidaAviso } from "@/lib/moddulo/lineasAvisoSalida";
import type { ExploracionParaM1 } from "@/lib/moddulo/m1Servidor";

/** Un proyecto PESTEL archivado (o con `deletedAt`, que hoy ninguno tiene) sigue existiendo pero no es un destino «vivo». */
function esArchivado(d: { status?: unknown; deletedAt?: unknown } | undefined): boolean {
  return d?.status === "archived" || !!d?.deletedAt;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const modduloProjectId = searchParams.get("moddulo_project_id");
  const pestelProjectId = searchParams.get("pestel_project_id");

  // Mode 2: direct lookup by pestel_project_id to get fresh currentStage
  if (pestelProjectId) {
    const doc = await adminDb
      .collection("pestel_projects")
      .doc(pestelProjectId)
      .get();
    if (!doc.exists || doc.data()?.userId !== session.uid) {
      return NextResponse.json({ found: false });
    }
    const base = { found: true, sourceId: doc.id, currentStage: doc.data()?.currentStage ?? 3, ...(esArchivado(doc.data()) ? { archivado: true } : {}) };
    // T5: con un análisis importado (verificar=1) el back-link debe apuntar a este Moddulo; si no, se deja en el log.
    if (searchParams.get("verificar") === "1" && modduloProjectId && doc.data()?.modduloProjectId !== modduloProjectId) {
      console.warn(`[find-linked-pestel][asimetria] t22_sin_backlink moddulo=${modduloProjectId} pestel=${doc.id}`);
    }
    // T4 (opt-in, sin ruta nueva): ¿el análisis que F2 importó sigue al día? Solo con `verificar=1` y el id del
    // Moddulo; sin esos parámetros la respuesta es exactamente la de siempre. Un fallo de lectura no afirma nada.
    if (searchParams.get("verificar") === "1" && modduloProjectId) {
      let origen: ResultadoOrigen;
      try {
        origen = await verificarOrigen(adminDb, {
          uid: session.uid,
          pestelProjectId: doc.id,
          pestelUserId: doc.data()?.userId,
          modduloProjectId,
        });
      } catch (err) {
        console.warn("[find-linked-pestel][verificar] no se pudo verificar el origen:", err instanceof Error ? err.name : "error");
        origen = { estado: "no_verificable", razon: "error_lectura" };
      }
      return NextResponse.json({ ...base, origen });
    }
    return NextResponse.json(base);
  }

  // Mode 1: query by modduloProjectId — ¿qué PESTEL del usuario apunta a este Moddulo? (el vínculo PENDIENTE de T5
  // vive solo en ese back-link). SOLO LECTURA: ya no hay «repair» (T5). El repair escribía el `linkedSource` del
  // Moddulo desde un GET —con `getProject`, que además escribe `lastAccessedAt`— y convertía el pendiente en el
  // estado N6 (T22 sin mapa ni análisis). Las asimetrías que antes tapaba ahora se ven en el log (tipo e ids, sin
  // contenido). Lecturas: la consulta (≥ 1) + el Moddulo con máscara de campos (1); 0 escrituras.
  if (modduloProjectId) {
    const snap = await adminDb
      .collection("pestel_projects")
      .where("modduloProjectId", "==", modduloProjectId)
      .where("userId", "==", session.uid)
      .get();

    // T5b (opt-in `salida=1`): además de las asimetrías, el estado de lo que se reemplazaría al volver con un análisis
    // (solo estado y rótulos de líneas). El MISMO `getAll` con la máscara ampliada: 2 lecturas en total, 0 escrituras.
    const salidaPedida = searchParams.get("salida") === "1";
    let salida: SalidaAviso | undefined = salidaPedida ? { estado: "no_verificable" } : undefined;

    // Best-effort: un fallo de lectura aquí nunca afecta la respuesta.
    try {
      const [modSnap] = await adminDb.getAll(adminDb.collection("moddulo_projects").doc(modduloProjectId), {
        fieldMask: ["collaborators", "deletedAt", "phases.exploracion.linkedSource.kind", "phases.exploracion.linkedSource.sourceId", "phases.exploracion.linkedSource.sourceAnalysisId",
          ...(salidaPedida ? ["phases.exploracion.status", "phases.exploracion.linkedSource.payload", "phases.exploracion.m1", "phases.exploracion.dvs", "phases.exploracion.draftDVS", "phases.exploracion.motorAprobaciones"] : [])],
      });
      const mod = modSnap?.exists ? (modSnap.data() as { collaborators?: Array<{ uid?: string }>; deletedAt?: unknown; phases?: { exploracion?: { linkedSource?: { kind?: string; sourceId?: string; sourceAnalysisId?: string } } } }) : undefined;
      if (mod && !mod.deletedAt && mod.collaborators?.some((c) => c.uid === session.uid)) {
        if (salidaPedida) salida = calcularSalida(mod.phases?.exploracion as ExploracionParaM1 | undefined);
        for (const a of clasificarAsimetrias({ modduloId: modduloProjectId, linkedSource: mod.phases?.exploracion?.linkedSource, backlinks: snap.docs.map((d) => d.id) })) {
          console.warn(`[find-linked-pestel][asimetria] ${a.tipo} moddulo=${a.modduloId} pestel=${a.pestelIds.join(",")}`);
        }
      }
    } catch {
      // sin aviso: la detección es solo diagnóstico
    }

    if (snap.empty) {
      return NextResponse.json({ found: false, ...(salida ? { salida } : {}) });
    }

    // Sort in memory: most recent first (handles duplicate edge case without requiring a composite index)
    const doc = snap.docs.sort((a, b) => {
      const aTime = (a.data().createdAt as Timestamp)?.seconds ?? 0;
      const bTime = (b.data().createdAt as Timestamp)?.seconds ?? 0;
      return bTime - aTime;
    })[0];

    return NextResponse.json({
      found: true,
      sourceId: doc.id,
      currentStage: doc.data().currentStage ?? 3,
      ...(esArchivado(doc.data()) ? { archivado: true } : {}),
      ...(salida ? { salida } : {}),
    });
  }

  return NextResponse.json(
    { error: "Se requiere moddulo_project_id o pestel_project_id" },
    { status: 400 }
  );
}
