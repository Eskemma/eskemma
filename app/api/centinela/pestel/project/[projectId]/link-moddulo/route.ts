// app/api/centinela/pestel/project/[projectId]/link-moddulo/route.ts
// POST { modduloProjectId, forceLink? }
// Bidirectionally links a PESTEL project to an existing Moddulo project.
// Validates compatibility, guards against conflicts, and imports MapaPESTEL if analysis exists.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import { transformToMapaPESTEL, type RawDimension } from "@/lib/centinela/pestel/transformToMapaPESTEL";
import type { Territorio } from "@/types/pestel.types";
import type { MapaPESTEL } from "@/types/moddulo.types";

type TerritoryMatch = "exact" | "approximate" | "mismatch";

function checkTerritoryMatch(
  p: Territorio,
  m: Territorio | undefined
): TerritoryMatch {
  if (!m) return "approximate";
  if (p.nivel !== m.nivel) return "mismatch";
  if (p.pais && m.pais && p.pais !== m.pais) return "mismatch";
  if (p.estado && m.estado && p.estado !== m.estado) return "mismatch";

  const isDistrito = ["distrito_federal", "distrito_local", "distrito"].includes(p.nivel);
  if (isDistrito) {
    if (p.cve_distrito && m.cve_distrito) {
      return p.cve_distrito === m.cve_distrito ? "exact" : "mismatch";
    }
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  if (p.nivel === "municipal") {
    if (p.municipio && m.municipio && p.municipio !== m.municipio) return "mismatch";
    return "approximate";
  }

  return "exact";
}

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  let body: { modduloProjectId?: string; forceLink?: boolean };
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

  // Conflict: Moddulo project's exploracion phase already has a different pestProjectId
  const explorarPhase = modduloProject.phases?.["exploracion"];
  const existingPestProjectId = explorarPhase?.pestProjectId;
  if (existingPestProjectId && existingPestProjectId !== projectId) {
    return NextResponse.json(
      {
        error: "moddulo_already_linked",
        message: "Este proyecto de Moddulo ya está vinculado a otro análisis PESTEL. Para cambiar la vinculación, contacta soporte.",
      },
      { status: 409 }
    );
  }

  // Tipo compatibility: hard block, no forceLink flag
  const pestelTipo = pestelData.tipo as string;
  const modduloType = modduloProject.type;
  if (pestelTipo !== modduloType) {
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
  const territoryMatch = checkTerritoryMatch(pestelTerritorio, modduloTerritorio);

  if (!forceLink && (territoryMatch === "mismatch" || territoryMatch === "approximate")) {
    return NextResponse.json(
      {
        error: "territorio_mismatch",
        approximate: territoryMatch === "approximate",
        pestelTerritorio: pestelTerritorio.nombre,
        modduloTerritorio: modduloTerritorio?.nombre ?? null,
        message:
          territoryMatch === "approximate"
            ? "Los territorios parecen coincidir pero no se pudo verificar con un identificador confiable. Revisa que sean el mismo territorio antes de vincular."
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

  // If Moddulo already has mapaPESTEL, check if it's from the same analysis (C7b guard)
  const existingAnalysisId = explorarPhase?.pestAnalysisId;
  const existingMapa = explorarPhase?.mapaPESTEL as MapaPESTEL | undefined;

  if (existingMapa) {
    if (existingAnalysisId === latestAnalysisId) {
      // Same analysis already imported — idempotent, just ensure PESTEL write-back
      await adminDb.collection("pestel_projects").doc(projectId).update({
        modduloProjectId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ modduloProjectId, pestAnalysisId: latestAnalysisId }, { status: 200 });
    }
    return NextResponse.json(
      {
        error: "moddulo_already_linked",
        message: "Este proyecto de Moddulo ya tiene un análisis PESTEL importado. Para cambiar la vinculación, contacta soporte.",
      },
      { status: 409 }
    );
  }

  // Write MapaPESTEL to Moddulo project (if analysis available)
  const updatePayload: Record<string, unknown> = {
    "phases.exploracion.pestProjectId": projectId,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (latestAnalysisId && latestAnalysisData) {
    const mapaPESTEL = transformToMapaPESTEL(
      (latestAnalysisData.dimensions ?? []) as RawDimension[]
    );
    updatePayload["phases.exploracion.pestAnalysisId"] = latestAnalysisId;
    updatePayload["phases.exploracion.mapaPESTEL"] = mapaPESTEL;
  }

  await adminDb.collection("moddulo_projects").doc(modduloProjectId).update(updatePayload);

  // Write back to PESTEL project
  await adminDb.collection("pestel_projects").doc(projectId).update({
    modduloProjectId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ modduloProjectId, pestAnalysisId: latestAnalysisId }, { status: 201 });
}
