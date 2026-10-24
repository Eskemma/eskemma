// app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts
// POST { modduloProjectId, forceLink?, confirmar?, huella? }
// H15 (paso 4): linking REPLACES the M1 of the Moddulo project. When something would be lost (the M1, its
// edits or approval, the motors draft or approvals) it answers 409 reemplazo_requiere_confirmacion with the
// real lines and the fingerprint to confirm against; the territory warning (forceLink) is a separate step.
// Bidirectionally links a PESTEL project to an existing Moddulo project.
// Validates compatibility, guards against conflicts, and imports MapaPESTEL if analysis exists.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { camposNuevoM1 } from "@/lib/moddulo/m1Escritura";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { decidirCandadoM1Servidor, respuestaCandadoM1, type DecisionCandadoM1Servidor } from "@/lib/moddulo/candadoM1Servidor";
import { transformToMapaPESTEL, type RawDimension } from "@/lib/centinela/pestel/transformToMapaPESTEL";
import { vinculoT22Ajeno } from "@/lib/centinela/pestel/vinculoUnico";
import { MENSAJE_MODDULO_CON_OTRO_PESTEL, MENSAJE_MODDULO_OTRA_VERSION } from "@/lib/moddulo/textosVinculo";
import { compararTerritorios, esTipoCompatible, explicarTerritorioApproximate } from "@/lib/moddulo/linkCompatibility";
import type { Territorio } from "@/types/pestel.types";
import type { MapaPESTEL, LinkedSourceRef } from "@/types/moddulo.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  let body: { modduloProjectId?: string; forceLink?: boolean; confirmar?: unknown; huella?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { modduloProjectId, forceLink = false } = body;
  if (!modduloProjectId) {
    return NextResponse.json({ error: "modduloProjectId es requerido" }, { status: 400 });
  }

  // Verify PESTEL project ownership
  const pestelSnap = await adminDb.collection("pestel_projects").doc(projectId).get();
  if (!pestelSnap.exists || pestelSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto PESTEL no encontrado" }, { status: 404 });
  }
  const pestelData = pestelSnap.data()!;

  // Idempotency: already linked to this same Moddulo project
  if (pestelData.modduloProjectId === modduloProjectId) {
    return NextResponse.json({ modduloProjectId }, { status: 200 });
  }

  // Conflict: PESTEL already linked to a different Moddulo project
  if (pestelData.modduloProjectId) {
    return NextResponse.json(
      { error: "pestel_already_linked", message: "Este proyecto PESTEL ya está vinculado a otro proyecto de Moddulo." },
      { status: 409 }
    );
  }

  // Verify Moddulo project ownership
  const modduloProject = await getProject(modduloProjectId, session.uid);
  if (!modduloProject) {
    return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
  }

  // F2 closed = read-only (same 409 fase_cerrada as the m1-* routes); re-checked inside the transaction.
  if (exploracionCerrada(modduloProject.phases?.exploracion)) return respuestaFaseCerrada();

  // Conflict: Moddulo project's exploracion phase already has a different pestProjectId
  const explorarPhase = modduloProject.phases?.["exploracion"];
  if (vinculoT22Ajeno(explorarPhase?.linkedSource, { pestelProjectId: projectId, modduloProjectId })) {
    return NextResponse.json(
      {
        error: "moddulo_already_linked",
        message: MENSAJE_MODDULO_CON_OTRO_PESTEL,
      },
      { status: 409 }
    );
  }

  // Tipo compatibility: hard block, no forceLink flag
  const pestelTipo = pestelData.tipo as string;
  const modduloType = modduloProject.type;
  if (!esTipoCompatible(pestelTipo, modduloType)) {
    return NextResponse.json(
      {
        error: "tipo_mismatch",
        pestelTipo,
        modduloType,
        message: `El análisis PESTEL es de tipo "${pestelTipo}" pero el proyecto de Moddulo es de tipo "${modduloType}". No son compatibles.`,
      },
      { status: 422 }
    );
  }

  // Territory compatibility: warning-only unless forceLink
  const pestelTerritorio = pestelData.territorio as Territorio;
  const modduloTerritorio = modduloProject.territorio;
  const { match: territoryMatch, relacion } = compararTerritorios(pestelTerritorio, modduloTerritorio);

  if (!forceLink && (territoryMatch === "mismatch" || territoryMatch === "approximate")) {
    return NextResponse.json(
      {
        error: "territorio_mismatch",
        approximate: territoryMatch === "approximate",
        pestelTerritorio: pestelTerritorio.nombre,
        modduloTerritorio: modduloTerritorio?.nombre ?? null,
        message:
          territoryMatch === "approximate"
            ? explicarTerritorioApproximate(relacion)
            : `El análisis PESTEL es de "${pestelTerritorio.nombre}" pero el proyecto de Moddulo cubre "${modduloTerritorio?.nombre ?? "territorio no especificado"}".`,
      },
      { status: 422 }
    );
  }

  // Get latest analysis for this PESTEL project (non-fatal if none)
  let latestAnalysisId: string | null = null;
  let latestAnalysisData: Record<string, unknown> | null = null;

  try {
    const analysesSnap = await adminDb
      .collection("pestel_analyses")
      .where("projectId", "==", projectId)
      .get();

    if (!analysesSnap.empty) {
      const getSeconds = (d: FirebaseFirestore.DocumentSnapshot): number => {
        const v = d.data()?.analyzedAt;
        if (!v) return 0;
        if (typeof v === "object" && "_seconds" in v) return (v as { _seconds: number })._seconds;
        return new Date(v as string).getTime() / 1000;
      };
      const vigentes = analysesSnap.docs.filter((d) => d.data().vigente !== false);
      const pool = vigentes.length > 0 ? vigentes : analysesSnap.docs;
      pool.sort((a, b) => getSeconds(b) - getSeconds(a));
      latestAnalysisId = pool[0].id;
      latestAnalysisData = pool[0].data() as Record<string, unknown>;
    }
  } catch (err) {
    console.error("[link-moddulo] error buscando análisis para projectId:", projectId, err);
  }

  // Write MapaPESTEL to Moddulo project (if analysis available)
  const linkedSource: LinkedSourceRef<MapaPESTEL> = {
    kind: "T22",
    componente: "centinela",
    sourceId: projectId,
  };
  const updatePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (latestAnalysisId && latestAnalysisData) {
    const mapaPESTEL = transformToMapaPESTEL(
      (latestAnalysisData.dimensions ?? []) as RawDimension[]
    );
    linkedSource.sourceAnalysisId = latestAnalysisId;
    linkedSource.payload = mapaPESTEL;
    updatePayload["phases.exploracion.xpctoSnapshotAtGeneration"] = JSON.stringify(modduloProject.xpcto ?? {});
    // M1 puede estar reemplazando uno de origen express (upgrade): el M1 vinculado es un M1 NUEVO en
    // borrador (m1Escritura.ts) y el borrador de motores y las aprobaciones hechos contra el anterior
    // se descartan; el Reporte F2 finalizado (`dvs`) no se toca.
    Object.assign(updatePayload, camposNuevoM1(FieldValue));
  }
  updatePayload["phases.exploracion.linkedSource"] = linkedSource;

  // 7b-2 (H25): TODA decisión que depende del estado vigente se toma dentro de UNA transacción que
  // relee los dos documentos y escribe ambos (antes: lecturas previas fuera y dos `update` sueltos —si
  // fallaba el segundo quedaba el Moddulo vinculado sin back-link— y los guards de doble vínculo se
  // evaluaban con una lectura que otra petición pudo invalidar: dos vinculaciones simultáneas del
  // mismo PESTEL a dos Moddulo, o de dos PESTEL al mismo Moddulo, podían pasar ambas). El callback
  // puede reintentarse: lee antes de escribir, sin efectos externos, y devuelve un resultado; la
  // respuesta HTTP se arma fuera. Las lecturas previas de arriba solo ordenan las respuestas (mismos
  // códigos y orden de siempre); el estado que cuenta es el que se lee aquí.
  const pestelRef = adminDb.collection("pestel_projects").doc(projectId);
  const modduloRef = adminDb.collection("moddulo_projects").doc(modduloProjectId);
  type ResultadoVinculo =
    | "ok"
    | "pestel_no_encontrado"
    | "moddulo_no_encontrado"
    | "idempotente"
    | "pestel_ya_vinculado"
    | "moddulo_ya_vinculado"
    | "mapa_ya_importado"
    | "mismo_analisis"
    | "fase_cerrada"
    | { candado: Exclude<DecisionCandadoM1Servidor, { accion: "continuar" }> };

  const resultado = await adminDb.runTransaction(async (tx): Promise<ResultadoVinculo> => {
    const pestelTx = await tx.get(pestelRef);
    const modduloTx = await tx.get(modduloRef);

    if (!pestelTx.exists || pestelTx.data()?.userId !== session.uid) return "pestel_no_encontrado";
    if (pestelTx.data()?.modduloProjectId === modduloProjectId) return "idempotente";
    if (pestelTx.data()?.modduloProjectId) return "pestel_ya_vinculado";

    // getProject filtra la papelera y exige ser colaborador; aquí solo se revalida que siga ahí.
    if (!modduloTx.exists || modduloTx.data()?.deletedAt) return "moddulo_no_encontrado";
    if (exploracionCerrada(modduloTx.data()?.phases?.exploracion)) return "fase_cerrada";
    const linkedActual = modduloTx.data()?.phases?.exploracion?.linkedSource as
      | { kind?: string; sourceId?: string; sourceAnalysisId?: string; payload?: unknown }
      | undefined;
    if (vinculoT22Ajeno(linkedActual, { pestelProjectId: projectId, modduloProjectId })) return "moddulo_ya_vinculado";

    // If Moddulo already has mapaPESTEL FROM A TRACKED CENTINELA ANALYSIS, check
    // if it's the same one (C7b guard). A mapaPESTEL with no pestAnalysisId came
    // from the express flow — that's the express→Centinela upgrade path this
    // endpoint must allow, not a conflict to protect against.
    if (linkedActual?.payload && linkedActual.sourceAnalysisId) {
      if (linkedActual.sourceAnalysisId === latestAnalysisId) {
        // Same analysis already imported — idempotent, just ensure PESTEL write-back
        tx.update(pestelRef, { modduloProjectId, updatedAt: FieldValue.serverTimestamp() });
        return "mismo_analisis";
      }
      return "mapa_ya_importado";
    }

    // The lock again, against the state read here and the fingerprint the user confirmed.
    const candado = decidirCandadoM1Servidor(modduloTx.data()?.phases?.exploracion, "vincular", {
      confirmar: body.confirmar,
      huella: body.huella,
    });
    if (candado.accion !== "continuar") return { candado };

    tx.update(modduloRef, updatePayload);
    // Write back to PESTEL project
    tx.update(pestelRef, { modduloProjectId, updatedAt: FieldValue.serverTimestamp() });
    return "ok";
  });

  if (typeof resultado === "object") return respuestaCandadoM1(resultado.candado);
  switch (resultado) {
    case "pestel_no_encontrado":
      return NextResponse.json({ error: "Proyecto PESTEL no encontrado" }, { status: 404 });
    case "moddulo_no_encontrado":
      return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
    case "idempotente":
      return NextResponse.json({ modduloProjectId }, { status: 200 });
    case "fase_cerrada":
      return respuestaFaseCerrada();
    case "pestel_ya_vinculado":
      return NextResponse.json(
        { error: "pestel_already_linked", message: "Este proyecto PESTEL ya está vinculado a otro proyecto de Moddulo." },
        { status: 409 }
      );
    case "moddulo_ya_vinculado":
      return NextResponse.json(
        {
          error: "moddulo_already_linked",
          message: MENSAJE_MODDULO_CON_OTRO_PESTEL,
        },
        { status: 409 }
      );
    case "mapa_ya_importado":
      return NextResponse.json(
        {
          error: "moddulo_already_linked",
          message: MENSAJE_MODDULO_OTRA_VERSION,
        },
        { status: 409 }
      );
    case "mismo_analisis":
      return NextResponse.json({ modduloProjectId, sourceAnalysisId: latestAnalysisId }, { status: 200 });
    case "ok":
      return NextResponse.json({ modduloProjectId, sourceAnalysisId: latestAnalysisId }, { status: 201 });
  }
}
