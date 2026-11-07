// app/api/centinela/pestel/project/[projectId]/route.ts
// GET    — fetch a single project
// PATCH  — update E1-E2 fields + status (isActive kept in sync automatically)
// DELETE — permanent deletion with cascade across related collections

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { getPestelProjectPropio } from "@/lib/centinela/pestel/projectPropio";
import { FieldValue } from "firebase-admin/firestore";
import { ajustesDelMapaImportado, type MapaImportadoResumen } from "@/lib/centinela/pestel/ajustesSinReflejar";
import { leerNotaGuardada, type NotaAprobacion } from "@/lib/centinela/pestel/notaAprobacion";
import type { PESTELProject, TipoProyecto, Territorio, PESTELProjectStatus } from "@/types/pestel.types";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const project = await getPestelProjectPropio(projectId, session.uid);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // T3 (opt-in: `?ajustesImportados=1`): resumen MÍNIMO del mapa que Moddulo F2 importó (solo el `ajuste` de cada
  // dimensión) para que Interpretación sepa si F2 ya refleja los ajustes. Una lectura del Moddulo vinculado; sin ruta
  // nueva. `null` = no se pudo saber (sin acceso, en papelera o inexistente): la pantalla no afirma nada.
  if (request.nextUrl.searchParams.get("ajustesImportados") === "1" && project.modduloProjectId) {
    let importado: MapaImportadoResumen | null = null;
    // T7 C3: la nota de aprobación que F2 importó y la versión de su huella (misma lectura del Moddulo: 0 lecturas extra).
    let notaImportada: { v: number | null; nota: NotaAprobacion | null; sourceAnalysisId: string | null } | null = null;
    try {
      const snap = await adminDb.collection("moddulo_projects").doc(project.modduloProjectId).get();
      const d = snap.exists ? snap.data() : undefined;
      const colabora = !!d?.collaborators?.some((c: { uid?: string }) => c.uid === session.uid);
      if (d && !d.deletedAt && colabora) {
        const ls = d.phases?.exploracion?.linkedSource;
        importado = ajustesDelMapaImportado(ls?.payload);
        notaImportada = { v: typeof ls?.huellaFuente?.v === "number" ? ls.huellaFuente.v : null, nota: leerNotaGuardada(ls?.aprobacionOrigen), sourceAnalysisId: typeof ls?.sourceAnalysisId === "string" ? ls.sourceAnalysisId : null };
      }
    } catch {
      importado = null;
      notaImportada = null;
    }
    return NextResponse.json({ project, importado, notaImportada });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<
    Pick<PESTELProject, "nombre" | "tipo" | "horizonte" | "color"> & {
      territorio: Territorio;
      status: PESTELProjectStatus;
    }
  >;

  const VALID_TIPOS: TipoProyecto[] = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  const VALID_STATUSES: PESTELProjectStatus[] = ["active", "paused", "archived"];
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (body.nombre !== undefined) updates.nombre = body.nombre;
  if (body.tipo !== undefined) {
    if (!VALID_TIPOS.includes(body.tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    updates.tipo = body.tipo;
  }
  if (body.territorio !== undefined) updates.territorio = body.territorio;
  if (body.horizonte !== undefined) updates.horizonte = body.horizonte;
  if (body.color !== undefined) updates.color = body.color;
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    updates.status = body.status;
    // Keep isActive in sync so scheduledMonitor.ts query stays valid
    updates.isActive = body.status !== "archived";
  }

  await adminDb.collection("pestel_projects").doc(projectId).update(updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const snap = await adminDb.collection("pestel_projects").doc(projectId).get();

  if (!snap.exists || snap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Cascade delete — query each related collection by projectId
  const RELATED_COLLECTIONS = [
    "pestel_variable_configs",
    "pestel_data_sources",
    "pestel_analyses",
    "pestel_jobs",
    "pestel_alerts",
    "pestel_raw_articles",
  ];

  const MAX_OPS = 499;

  for (const col of RELATED_COLLECTIONS) {
    const query = await adminDb.collection(col).where("projectId", "==", projectId).get();
    if (query.empty) continue;

    // Process in batches of MAX_OPS
    for (let i = 0; i < query.docs.length; i += MAX_OPS) {
      const batch = adminDb.batch();
      query.docs.slice(i, i + MAX_OPS).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Delete the project document itself
  await adminDb.collection("pestel_projects").doc(projectId).delete();

  return NextResponse.json({ success: true });
}
