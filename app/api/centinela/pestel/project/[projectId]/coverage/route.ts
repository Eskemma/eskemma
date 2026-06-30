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

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import type { CoverageStatus, DimensionCode } from "@/types/pestel.types";
import { DIMENSION_ORDER } from "@/types/pestel.types";

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

  const coverage: CoverageStatus[] = DIMENSION_CODES.map((code) => {
    const manualSources = byDimension[code];
    const manualCount = manualSources.length;

    if (manualCount === 0) {
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

    // Red only if manual data is present but has very low reliability
    let status: CoverageStatus["status"];
    if (avgConfidence < 40) {
      status = "red";
    } else if (manualCount < 3) {
      status = "yellow";
    } else {
      status = "green";
    }

    return {
      code,
      status,
      variablesWithData: manualCount,
      confidence: Math.round(avgConfidence),
    };
  });

  // Block only if any dimension has actual bad data (not just missing manual data)
  const hasRed = coverage.some((c) => c.status === "red");

  return NextResponse.json({ coverage, canTriggerAnalysis: !hasRed });
}
