// POST /api/moddulo/f2/web-context
// Session-authenticated endpoint for the F2 page to fetch web context
// for non-Mexico projects. Distinct from /api/internal/web-context which
// uses X-Internal-Secret for Cloud Function calls.

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import {
  fetchWebEconomicContext,
  fetchWebLegalContext,
  fetchWebElectoralContext,
} from "@/lib/search/webContextFetcher";
import type { Territorio } from "@/types/pestel.types";

type ContextType = "economic" | "legal" | "electoral";

interface RequestBody {
  tipo: ContextType;
  territorio: Territorio;
}

const VALID_TYPES: ContextType[] = ["economic", "legal", "electoral"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tipo, territorio } = body;
  if (!tipo || !territorio) {
    return NextResponse.json(
      { error: "tipo y territorio son requeridos" },
      { status: 400 }
    );
  }

  if (!VALID_TYPES.includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  try {
    const result =
      tipo === "economic"
        ? await fetchWebEconomicContext(territorio)
        : tipo === "legal"
          ? await fetchWebLegalContext(territorio)
          : await fetchWebElectoralContext(territorio);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[web-context f2] Error fetching context:", err);
    return NextResponse.json(
      { disponible: false, indicadores: [] },
      { status: 200 }
    );
  }
}
