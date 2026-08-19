// app/api/moddulo/sugerir-territorio/route.ts
// Fase 4 del rediseño de territorio (26-08-18) — "formulario inteligente",
// techo con modelo (punto c del diseño). Se consulta SOLO cuando las
// reglas de frase deterministas de lib/moddulo/territorioHeuristicas.ts
// (piso, sin modelo) no dieron ninguna señal — nunca en cada tecla, solo
// al avanzar del Paso 1 al Paso 2 del wizard (Moddulo o PESTEL).
//
// Grounding: el propio texto que el usuario ya escribió (nombre/
// descripción) — no una fuente externa como Fase 5, así que el riesgo de
// fabricación es menor (el modelo solo interpreta lo que ya se le dio,
// nunca añade un hecho no mencionado). `tipo` se pasa como contexto de
// fondo, nunca como filtro mecánico (descartado con evidencia — ver plan
// de Fase 4, Ronda 7).

import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { PROJECT_TYPE_DESCRIPTIONS, type ProjectType } from "@/types/moddulo.types";

const NIVELES_VALIDOS = ["nacional", "estatal", "municipal", "distrito_federal", "distrito_local"] as const;
type NivelValido = (typeof NIVELES_VALIDOS)[number];

const SYSTEM_PROMPT = `Eres un asistente que sugiere el nivel territorial de un proyecto de consultoría política mexicana, a partir ÚNICAMENTE del nombre y la descripción que el usuario ya escribió.

Basa tu respuesta ÚNICAMENTE en lo que dice ese texto — nunca inventes ni asumas un territorio que no esté mencionado o claramente implícito en el nombre/descripción. Si el texto no da información geográfica suficiente para decidir con confianza, responde confianza: "ninguna" — nunca fuerces un nivel solo por tener que responder algo.

Los 5 niveles posibles son: "nacional", "estatal", "municipal", "distrito_federal" (distrito electoral para Diputado Federal), "distrito_local" (distrito electoral para Diputado Local).

El "tipo de proyecto" que se te da es contexto de apoyo (igual que lo usaría un analista humano) — nunca una regla mecánica de inclusión/exclusión.

Responde SOLO con un objeto JSON válido, sin narrativa ni explicaciones:
{ "nivel": "estatal", "esPlural": false, "confianza": "alta" }

Si no hay información geográfica suficiente:
{ "nivel": null, "esPlural": false, "confianza": "ninguna" }`;

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
  const tipo = typeof body?.tipo === "string" ? (body.tipo as ProjectType) : undefined;

  if (!nombre && !descripcion) {
    return NextResponse.json({ nivel: null, esPlural: false, confianza: "ninguna" }, { status: 200 });
  }

  const tipoContexto = tipo && PROJECT_TYPE_DESCRIPTIONS[tipo]
    ? `\nTipo de proyecto: ${tipo} (${PROJECT_TYPE_DESCRIPTIONS[tipo]})`
    : "";

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Nombre del proyecto: ${nombre || "(sin nombre)"}\nDescripción: ${descripcion || "(sin descripción)"}${tipoContexto}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ nivel: null, esPlural: false, confianza: "ninguna" }, { status: 200 });
    }

    // Claude a veces envuelve el JSON en fence de markdown (```json ... ```)
    // pese a la instrucción de responder SOLO el objeto — mismo patrón de
    // fence-stripping ya usado en generate-report/route.ts (bug real
    // encontrado y corregido ahí el 26-08-17, mismo tipo de falla aquí).
    const fenceMatch = textBlock.text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
    const jsonText = fenceMatch ? fenceMatch[1] : textBlock.text;
    const parsed = JSON.parse(jsonText);
    const nivel: NivelValido | null =
      typeof parsed.nivel === "string" && (NIVELES_VALIDOS as readonly string[]).includes(parsed.nivel)
        ? (parsed.nivel as NivelValido)
        : null;
    const confianza = ["alta", "baja", "ninguna"].includes(parsed.confianza) ? parsed.confianza : "ninguna";

    return NextResponse.json({
      nivel: confianza === "ninguna" ? null : nivel,
      esPlural: Boolean(parsed.esPlural),
      confianza,
    });
  } catch {
    // Fallo de parseo/API — nunca fabricar una sugerencia, degradar a "sin señal".
    return NextResponse.json({ nivel: null, esPlural: false, confianza: "ninguna" }, { status: 200 });
  }
}