// app/api/geo/resolver-municipio/route.ts
// Fase 5 del rediseño de territorio (Ronda 8, 26-08-18) — expone al
// cliente la resolución nombre→cve de municipio (resolveMunicipioCve,
// server-only por depender de firebase-admin/storage) para que
// TerritorySelector.tsx (client component) pueda validar contra el
// catálogo INEGI al momento de capturar, no solo Fontana después.
//
// Sin autenticación de sesión — mismo criterio que /api/geo/options
// (catálogo geográfico público, sin datos de usuario). Timeout explícito
// del lado del servidor (mismo patrón que withTimeout()/
// DOWNLOAD_TIMEOUT_MS de P2, app/api/geo/options/route.ts): un cuelgue
// de Storage no debe colgar la petición del cliente indefinidamente.

import { type NextRequest, NextResponse } from "next/server";
import { resolveMunicipioCve, diagnosticarMunicipioNoResuelto, normalizeGeoName } from "@/lib/geo/municipios";
import { ESTADO_CVE_MAP } from "@/lib/sefix/eleccionesConstants";
import { withTimeout } from "@/lib/utils/withTimeout";

const TIMEOUT_MS = 15000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  // `estado` viaja como NOMBRE (ej. "Jalisco") — mismo formato que
  // TerritorySelector.tsx ya usa para estadosSeleccionados. Conversión a
  // cve aquí, mismo criterio ya usado en agruparUnidadesPorEstado
  // (lib/fontana/ingesta/index.ts) — no duplicar como un cve crudo
  // esperado del cliente.
  const estadoNombre = typeof body?.estado === "string" ? body.estado.trim() : "";
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";

  if (!estadoNombre || !nombre) {
    return NextResponse.json({ error: "Faltan 'estado' o 'nombre'" }, { status: 400 });
  }

  const estado = ESTADO_CVE_MAP[normalizeGeoName(estadoNombre)];
  if (!estado) {
    return NextResponse.json({ error: `Estado "${estadoNombre}" no reconocido en el catálogo INEGI` }, { status: 400 });
  }

  try {
    const cve = await withTimeout(resolveMunicipioCve(estado, nombre), TIMEOUT_MS, "resolveMunicipioCve()");
    if (cve) {
      return NextResponse.json({ cve });
    }

    const candidatos = await withTimeout(
      diagnosticarMunicipioNoResuelto(estado, nombre),
      TIMEOUT_MS,
      "diagnosticarMunicipioNoResuelto()"
    );
    if (candidatos.length > 1) {
      return NextResponse.json({ ambiguo: true, candidatos });
    }
    return NextResponse.json({ noEncontrado: true });
  } catch (err) {
    // Timeout o fallo real de Storage — nunca colgar al cliente,
    // TerritorySelector.tsx degrada a agregar el texto tal cual con aviso.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error resolviendo municipio" }, { status: 500 });
  }
}
