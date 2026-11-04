// app/api/centinela/pestel/project/route.ts
// GET  /api/centinela/pestel/project  — list user's projects
// POST /api/centinela/pestel/project  — create new project (E1-E2)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getProject } from "@/lib/moddulo/project";
import { exploracionCerrada, respuestaFaseCerrada } from "@/lib/moddulo/faseCerrada";
import { MENSAJE_MODDULO_CON_OTRO_PESTEL } from "@/lib/moddulo/textosVinculo";
import type { PESTELProject } from "@/types/pestel.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snap = await adminDb
    .collection("pestel_projects")
    .where("userId", "==", session.uid)
    .get();

  type ProjectDoc = PESTELProject & { id: string };
  const projects: ProjectDoc[] = snap.docs
    .map((doc) => {
      const raw = doc.data();
      // Lazy migration: derive status from isActive for pre-status documents
      const status: PESTELProject["status"] =
        raw.status ?? (raw.isActive === false ? "archived" : "active");
      return { id: doc.id, ...raw, status } as ProjectDoc;
    })
    .sort((a, b) => {
      const aTime = (a.createdAt as { _seconds?: number })?._seconds ?? 0;
      const bTime = (b.createdAt as { _seconds?: number })?._seconds ?? 0;
      return bTime - aTime;
    });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<PESTELProject> & {
    modduloProjectId?: string;
    modduloOrigenEscenario?: "A" | "B";
  };
  const {
    nombre, tipo, territorio, horizonte, alertas,
    color, modduloProjectId, modduloOrigenEscenario,
  } = body;

  if (!nombre || !tipo || !territorio || !horizonte) {
    return NextResponse.json(
      { error: "nombre, tipo, territorio y horizonte son requeridos" },
      { status: 400 }
    );
  }

  const validTypes = ["electoral", "gubernamental", "legislativo", "ciudadano"];
  if (!validTypes.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  // Verify Moddulo project ownership BEFORE any use of modduloProjectId: the transaction below reads
  // moddulo_projects/{modduloProjectId} via Admin SDK. Same check as link-moddulo/route.ts.
  if (modduloProjectId) {
    const modduloProject = await getProject(modduloProjectId, session.uid);
    if (!modduloProject) {
      return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
    }
  }

  const projectRef = adminDb.collection("pestel_projects").doc();
  const now = FieldValue.serverTimestamp();

  const projectData: Record<string, unknown> = {
    userId: session.uid,
    nombre,
    tipo,
    territorio,
    horizonte,
    status: "active",
    isActive: true,
    autoMonitorEnabled: false,
    alertas: alertas ?? {
      vectorRiesgoUmbral: 70,
      notificarEmail: false,
      notificarInApp: true,
    },
    currentStage: 3, // ready to configure variables
    createdAt: now,
    updatedAt: now,
  };

  if (color) projectData.color = color;
  if (modduloProjectId) projectData.modduloProjectId = modduloProjectId;
  if (modduloOrigenEscenario) projectData.modduloOrigenEscenario = modduloOrigenEscenario;

  // Sin Moddulo de origen no hay nada que vincular: el camino no cambia.
  if (!modduloProjectId) {
    await projectRef.set(projectData);
    return NextResponse.json({ projectId: projectRef.id }, { status: 201 });
  }

  // T5 (N6): el vínculo PENDIENTE vive SOLO en el back-link `pestel_projects.modduloProjectId`. Este POST ya no
  // escribe NADA en el Moddulo (antes dejaba un `linkedSource` T22 sin mapa ni análisis, que F2 leía como
  // «vinculado» y que sobre un express mezclaba `kind` T22 con contenido express). El Moddulo lo sigue siendo de
  // su `linkedSource` hasta que `import-pestel` importe de verdad.
  //
  // UNA transacción: lee el Moddulo (existe, sin papelera, Fase 2 abierta), busca un PESTEL del usuario que ya lo
  // reclame y, si no hay, crea el nuevo. Dedup: si ya hay uno, responde 200 con el más reciente y no escribe.
  // Residual declarado: la consulta bloquea los documentos que devuelve, pero no impide por sí sola que otra
  // transacción inserte a la vez un PESTEL con el mismo back-link (dos pestañas en el mismo instante).
  type Resultado =
    | { creado: true }
    | { dedup: string }
    | "no_encontrado"
    | "fase_cerrada"
    | "moddulo_ya_vinculado";
  const modRef = adminDb.collection("moddulo_projects").doc(modduloProjectId);
  let resultado: Resultado;
  try {
    resultado = await adminDb.runTransaction(async (tx): Promise<Resultado> => {
      const modSnap = await tx.get(modRef);
      if (!modSnap.exists || modSnap.data()?.deletedAt) return "no_encontrado";
      const exploracion = modSnap.data()?.phases?.exploracion;
      if (exploracionCerrada(exploracion)) return "fase_cerrada";

      const existentes = await tx.get(
        adminDb
          .collection("pestel_projects")
          .where("userId", "==", session.uid)
          .where("modduloProjectId", "==", modduloProjectId)
      );
      if (!existentes.empty) {
        const masReciente = [...existentes.docs].sort((a, b) => {
          const at = (a.data().createdAt as { _seconds?: number })?._seconds ?? 0;
          const bt = (b.data().createdAt as { _seconds?: number })?._seconds ?? 0;
          return bt - at;
        })[0];
        return { dedup: masReciente.id };
      }

      // Un T22 con análisis importado sin back-link (asimetría; 0 casos reales): no se le agrega otro PESTEL.
      const ls = exploracion?.linkedSource as { kind?: string; sourceAnalysisId?: string } | undefined;
      if (ls?.kind === "T22" && ls.sourceAnalysisId) return "moddulo_ya_vinculado";

      tx.set(projectRef, projectData);
      return { creado: true };
    });
  } catch (err) {
    console.error("[pestel/project POST] transacción falló para modduloProjectId:", modduloProjectId, err instanceof Error ? err.name : "error");
    return NextResponse.json({ error: "No se pudo crear el proyecto" }, { status: 500 });
  }

  if (resultado === "no_encontrado") {
    return NextResponse.json({ error: "Proyecto Moddulo no encontrado" }, { status: 404 });
  }
  if (resultado === "fase_cerrada") return respuestaFaseCerrada();
  if (resultado === "moddulo_ya_vinculado") {
    return NextResponse.json({ error: "moddulo_already_linked", message: MENSAJE_MODDULO_CON_OTRO_PESTEL }, { status: 409 });
  }
  if ("dedup" in resultado) return NextResponse.json({ projectId: resultado.dedup }, { status: 200 });
  return NextResponse.json({ projectId: projectRef.id }, { status: 201 });
}
