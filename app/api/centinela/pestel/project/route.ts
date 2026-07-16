// app/api/centinela/pestel/project/route.ts
// GET  /api/centinela/pestel/project  — list user's projects
// POST /api/centinela/pestel/project  — create new project (E1-E2)

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
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

  // Dedup: if a pestel_project with this modduloProjectId already exists, return it
  // and retry the write-back (the most likely cause of a dedup hit is a prior failed write-back).
  if (modduloProjectId) {
    try {
      const existingSnap = await adminDb
        .collection("pestel_projects")
        .where("userId", "==", session.uid)
        .where("modduloProjectId", "==", modduloProjectId)
        .get();

      if (!existingSnap.empty) {
        const existing = existingSnap.docs.sort((a, b) => {
          const at = (a.data().createdAt as { _seconds?: number })?._seconds ?? 0;
          const bt = (b.data().createdAt as { _seconds?: number })?._seconds ?? 0;
          return bt - at;
        })[0];

        try {
          await adminDb
            .collection("moddulo_projects")
            .doc(modduloProjectId)
            .update({
              "phases.exploracion.pestProjectId": existing.id,
              updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (wbErr) {
          console.error(
            "[pestel/project POST] write-back retry falló para modduloProjectId:",
            modduloProjectId, "→ pestProjectId:", existing.id, wbErr
          );
        }

        return NextResponse.json({ projectId: existing.id }, { status: 200 });
      }
    } catch (err) {
      console.error(
        "[pestel/project POST] dedup query falló para modduloProjectId:", modduloProjectId, err
      );
      // Permissive: proceed with creation rather than block on query failure.
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

  await projectRef.set(projectData);

  // Write-back: let Moddulo know about the linked PESTEL project immediately,
  // without waiting for the round-trip import (pest_analysis_id in URL).
  if (modduloProjectId) {
    try {
      await adminDb
        .collection("moddulo_projects")
        .doc(modduloProjectId)
        .update({
          "phases.exploracion.pestProjectId": projectRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch {
      // Non-fatal: the fallback query in F2 covers this case.
    }
  }

  return NextResponse.json({ projectId: projectRef.id }, { status: 201 });
}
