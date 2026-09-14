// app/api/centinela/pestel/project/[projectId]/coverage/route.ts
// GET /api/centinela/pestel/project/[projectId]/coverage
// Returns coverage semaphore status per PEST-L dimension (E4).
//
// Semaphore logic:
//   green  = ≥3 manual sources with data in this dimension
//   yellow = 1-2 manual sources  OR  0 manual sources (auto scraping will run)
//   red    = existing data with avg confidence < 40 (poor quality signal)
//
// Key design decision: absence of manual data is NOT a blocker.
// PESTEL always runs automatic scrapers (Google News, DOF, INEGI, Banxico)
// when the trigger fires. Manual data is supplementary — it improves
// coverage but is never required to start an analysis.
//
// Fontana (26-09-13, integración PESTEL↔Fontana aprobada por Raúl): para
// Económico/Social/Ecológico, Fontana cuenta como fuente automática de
// pleno derecho, con el mismo nivel de confianza que las demás fuentes
// automáticas — si el registry de Fontana confirma cobertura para el
// territorio del proyecto, la dimensión se marca verde SIN requerir carga
// manual, sin importar si esa variable hoy cita una fuente (CONEVAL,
// SESNSP, etc.) como carga manual en `presets.ts`. La comprobación es
// contra el registry estático (nunca resuelve el dato en vivo — esta ruta
// se consulta en cada visita a Etapa 4, y los adaptadores externos de
// Fontana pueden tardar varios segundos).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { CoverageStatus, DimensionCode } from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";
import { fontanaCubreDimension } from "@/lib/fontana/tabla/insumosPestel";
import type { DimensionPestelConFontana } from "@/lib/fontana/pestelInsumos";
import type { Territorio } from "@/types/shared.types";

const DIMENSIONES_CON_FONTANA: DimensionPestelConFontana[] = ["E", "S", "Ec"];

// Confianza asignada cuando Fontana cubre la dimensión automáticamente —
// mismo nivel que las demás fuentes automáticas (AUTO_ONLY_CONFIDENCE de
// abajo refleja la cobertura "moderada" de los scrapers genéricos de
// noticias/DOF; Fontana, con datos verificados y trazabilidad de fuente,
// se asigna al mismo nivel que una fuente manual de alta confiabilidad).
const FONTANA_AUTO_CONFIDENCE = 90;

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

const DIMENSION_CODES: DimensionCode[] = DIMENSION_ORDER;

const RELIABILITY_CONFIDENCE: Record<string, number> = {
  HIGH: 90,
  MEDIUM: 65,
  LOW: 35,
};

// Estimated confidence when only automatic sources will be used.
// Reflects that scrapers provide moderate coverage of public data.
const AUTO_ONLY_CONFIDENCE = 55;

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;

  // Verify ownership
  const projectSnap = await adminDb
    .collection("pestel_projects")
    .doc(projectId)
    .get();

  if (!projectSnap.exists || projectSnap.data()?.userId !== session.uid) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  // Fetch all manual data sources for this project
  const sourcesSnap = await adminDb
    .collection("pestel_data_sources")
    .where("projectId", "==", projectId)
    .get();

  // Group manual sources by dimension
  const byDimension: Record<DimensionCode, { reliabilityLevel: string }[]> = {
    P: [], E: [], S: [], T: [], L: [], Ec: [],
  };

  for (const doc of sourcesSnap.docs) {
    const data = doc.data();
    const code = data.dimensionCode as DimensionCode;
    if (byDimension[code]) {
      byDimension[code].push({ reliabilityLevel: data.reliabilityLevel ?? "MEDIUM" });
    }
  }

  const territorio = projectSnap.data()?.territorio as Territorio | undefined;
  const fontanaPorDimension: Partial<Record<DimensionCode, boolean>> = {};
  if (territorio) {
    await Promise.all(
      DIMENSIONES_CON_FONTANA.map(async (code) => {
        fontanaPorDimension[code] = await fontanaCubreDimension(code, territorio.nivel);
      })
    );
  }

  const coverage: CoverageStatus[] = DIMENSION_CODES.map((code) => {
    const manualSources = byDimension[code];
    const manualCount = manualSources.length;
    const fontanaCubre = fontanaPorDimension[code] === true;

    if (manualCount === 0) {
      if (fontanaCubre) {
        // Fontana resuelve esta dimensión automáticamente — fuente
        // automática de pleno derecho, sin necesidad de carga manual.
        return {
          code,
          status: "green" as const,
          variablesWithData: 0,
          confidence: FONTANA_AUTO_CONFIDENCE,
        };
      }
      // No manual data yet — automatic scrapers will cover this dimension.
      // Show yellow (not red): the analysis can proceed, manual data is optional.
      return {
        code,
        status: "yellow" as const,
        variablesWithData: 0,
        confidence: AUTO_ONLY_CONFIDENCE,
      };
    }

    // Manual data exists — compute actual quality
    const avgConfidence =
      manualSources.reduce(
        (sum, s) => sum + (RELIABILITY_CONFIDENCE[s.reliabilityLevel] ?? 65),
        0
      ) / manualCount;

    // Red only if manual data is present but has very low reliability —
    // Fontana no sobrescribe una señal real de mala calidad en los datos
    // manuales ya cargados.
    let status: CoverageStatus["status"];
    if (avgConfidence < 40) {
      status = "red";
    } else if (manualCount < 3) {
      status = fontanaCubre ? "green" : "yellow";
    } else {
      status = "green";
    }

    return {
      code,
      status,
      variablesWithData: manualCount,
      confidence: status === "green" && fontanaCubre && manualCount < 3
        ? Math.max(Math.round(avgConfidence), FONTANA_AUTO_CONFIDENCE)
        : Math.round(avgConfidence),
    };
  });

  // Block only if any dimension has actual bad data (not just missing manual data)
  const hasRed = coverage.some((c) => c.status === "red");

  return NextResponse.json({ coverage, canTriggerAnalysis: !hasRed });
}
