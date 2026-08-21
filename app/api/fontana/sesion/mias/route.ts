// app/api/fontana/sesion/mias/route.ts
// GET — lista TODAS las sesiones del usuario autenticado (sueltas,
// archivadas y vinculadas a un proyecto de Moddulo), para el hub de
// Fontana. Antes solo devolvía las sueltas — corregido (2026-08-21):
// una sesión vinculada desaparecía del hub sin ninguna forma de
// volver a encontrarla desde Fontana. Las vinculadas traen además
// `proyectoVinculado` (nombre + fase actual) para que el hub pueda
// mostrarlas en su propia sección y navegar directo al proyecto.
//
// Mismo criterio que los hubs de PESTEL/Moddulo: fetch-todo-por-uid y
// filtrar/agrupar en código, sin índice compuesto nuevo en Firestore.
//
// Punto C — autorización explícita: el uid SIEMPRE viene de
// getSessionFromRequest (servidor), nunca de un query param del
// cliente — este endpoint no acepta ni lee ningún uid de la URL.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaSesion } from "@/types/fontana.types";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snap = await adminDb.collection("fontana_sesiones").where("uid", "==", session.uid).get();
  const sesiones = snap.docs
    .map((doc) => ({ sesionId: doc.id, ...doc.data() }) as FontanaSesion)
    .sort((a, b) => (a.fechaUltimoGuardado < b.fechaUltimoGuardado ? 1 : -1));

  const proyectoIds = [...new Set(sesiones.map((s) => s.modduloProjectId).filter((id): id is string => !!id))];
  const proyectos = await Promise.all(
    proyectoIds.map(async (id) => {
      const doc = await adminDb.collection("moddulo_projects").doc(id).get();
      return [id, doc.exists ? { nombre: doc.data()?.name as string, currentPhase: doc.data()?.currentPhase as string } : null] as const;
    })
  );
  const proyectosPorId = new Map(proyectos);

  const sesionesConProyecto = sesiones.map((s) => ({
    ...s,
    proyectoVinculado: s.modduloProjectId ? proyectosPorId.get(s.modduloProjectId) ?? undefined : undefined,
  }));

  return NextResponse.json({ sesiones: sesionesConProyecto }, { status: 200 });
}
