// app/api/geo/candidatos/route.ts
// Reference disambiguation (step 1 of the standard, 26-09-23): given what a user
// typed, answer "one entity", "these few (ask)", "too many (ask for the state)" or
// "nothing" — see lib/geo/desambiguar.ts for the rules. The form picker and the chat
// tools are two presentations of this same answer.
//
// The municipality catalog is server-only (Storage), so it is injected here. No
// session, same criterion as /api/geo/options and /api/geo/resolver-municipio (public
// geographic catalog, no user data); input is bounded instead. Does NOT replace
// resolver-municipio yet: nothing consumes this endpoint until step 2.

import { type NextRequest, NextResponse } from "next/server";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { resolverEstadoCve } from "@/lib/geo/estados";
import { desambiguarReferencia, TIPOS_REFERENCIA, type TipoReferencia } from "@/lib/geo/desambiguar";
import { withTimeout } from "@/lib/utils/withTimeout";

const TIMEOUT_MS = 15000;
const MAX_TEXTO = 100;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
  if (!texto) {
    return NextResponse.json({ error: "Falta 'texto'" }, { status: 400 });
  }
  if (texto.length > MAX_TEXTO) {
    return NextResponse.json({ error: `'texto' excede ${MAX_TEXTO} caracteres` }, { status: 400 });
  }

  // `estado` travels as a NAME (as in resolver-municipio) and is converted to a CVE here.
  let estadoCve: string | undefined;
  if (body?.estado !== undefined && body.estado !== null && body.estado !== "") {
    const cve = typeof body.estado === "string" ? resolverEstadoCve(body.estado) : null;
    if (!cve) {
      return NextResponse.json({ error: "'estado' no reconocido en el catálogo" }, { status: 400 });
    }
    estadoCve = cve;
  }

  let tipos: TipoReferencia[] | undefined;
  if (body?.tipos !== undefined) {
    const validos = Array.isArray(body.tipos)
      ? body.tipos.filter((t: unknown): t is TipoReferencia => TIPOS_REFERENCIA.includes(t as TipoReferencia))
      : [];
    if (!Array.isArray(body.tipos) || validos.length !== body.tipos.length || validos.length === 0) {
      return NextResponse.json(
        { error: `'tipos' debe ser una lista no vacía de: ${TIPOS_REFERENCIA.join(", ")}` },
        { status: 400 }
      );
    }
    tipos = validos;
  }

  if (body?.mexico !== undefined && body.mexico !== "pais" && body.mexico !== "estado") {
    return NextResponse.json({ error: "'mexico' debe ser 'pais' o 'estado'" }, { status: 400 });
  }

  try {
    // The catalog is only needed when municipalities are in play.
    const conMunicipios = !tipos || tipos.includes("municipio");
    const municipios = conMunicipios
      ? (await withTimeout(getMunicipiosOptionsNacional(), TIMEOUT_MS, "getMunicipiosOptionsNacional()")).map((m) => ({
          estadoCve: m.estadoCve,
          nombre: m.nombre,
          cve: m.cve,
        }))
      : [];

    return NextResponse.json(
      desambiguarReferencia(texto, { estadoCve, tipos, municipios, mexico: body?.mexico })
    );
  } catch (err) {
    // Timeout or a real Storage failure: never hang the client.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error resolviendo la referencia" },
      { status: 500 }
    );
  }
}
