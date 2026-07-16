// POST /api/internal/web-context
// Internal endpoint for Cloud Functions to fetch web economic/legal/electoral
// context for non-Mexico projects. Protected by X-Internal-Secret header.

import { type NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
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

  const VALID_TYPES: ContextType[] = ["economic", "legal", "electoral"];
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
    console.error("[web-context] Error fetching context:", err);
    return NextResponse.json(
      { disponible: false, indicadores: [] },
      { status: 200 }
    );
  }
}
