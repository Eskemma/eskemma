import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type { SearchResult, WebContextResult } from "./SearchProvider";

// For economic context: restricts to explicitly stated numeric values.
const EXTRACTION_SYSTEM_ECONOMIC = `Eres un extractor de datos económicos.
Se te dan snippets de búsqueda web con título, URL y descripción.
Basa tu respuesta ÚNICAMENTE en lo que dicen esos snippets — no inferas ni inventes valores numéricos que no aparezcan explícitamente en el texto.
Si un campo fecha no aparece en el snippet, usa fecha: null.
Responde SOLO con un objeto JSON válido, sin narrativa ni explicaciones:

{
  "disponible": true,
  "indicadores": [
    { "nombre": "...", "valor": "...", "fuente": "...", "url": "...", "fecha": "..." }
  ]
}

Si los snippets no contienen valores numéricos confiables o información económica relevante:
{ "disponible": false, "indicadores": [] }`;

// For legal context: "valor" is qualitative (law name, decree, validity status).
// The anti-fabrication rule still applies: only content explicitly in the snippets.
const EXTRACTION_SYSTEM_LEGAL = `Eres un extractor de marcos legales y normativos.
Se te dan snippets de búsqueda web con título, URL y descripción.
Basa tu respuesta ÚNICAMENTE en lo que dicen esos snippets — no inventes ni parafrasees contenido que no aparezca explícitamente en el texto.
Si un campo fecha no aparece en el snippet, usa fecha: null.
Para contenido legal, "valor" puede ser una descripción textual (nombre de la ley o decreto, estado de vigencia, ámbito de aplicación) — no necesariamente una cifra numérica.
Responde SOLO con un objeto JSON válido, sin narrativa ni explicaciones:

{
  "disponible": true,
  "indicadores": [
    { "nombre": "...", "valor": "...", "fuente": "...", "url": "...", "fecha": "..." }
  ]
}

Si los snippets no contienen información legal o normativa relevante:
{ "disponible": false, "indicadores": [] }`;

// For electoral context: mix of numeric (results, turnout) and qualitative (party names, candidates).
const EXTRACTION_SYSTEM_ELECTORAL = `Eres un extractor de contexto electoral.
Se te dan snippets de búsqueda web con título, URL y descripción.
Basa tu respuesta ÚNICAMENTE en lo que dicen esos snippets — no inventes ni parafrasees contenido que no aparezca explícitamente en el texto.
Si un campo fecha no aparece en el snippet, usa fecha: null.
"valor" puede ser numérico (porcentaje de votos, participación) o textual (nombre de partido ganador, resultado de elección).
Responde SOLO con un objeto JSON válido, sin narrativa ni explicaciones:

{
  "disponible": true,
  "indicadores": [
    { "nombre": "...", "valor": "...", "fuente": "...", "url": "...", "fecha": "..." }
  ]
}

Si los snippets no contienen información electoral relevante:
{ "disponible": false, "indicadores": [] }`;

function getSystemPrompt(tipo: string): string {
  if (tipo === "legal") return EXTRACTION_SYSTEM_LEGAL;
  if (tipo === "electoral") return EXTRACTION_SYSTEM_ELECTORAL;
  return EXTRACTION_SYSTEM_ECONOMIC;
}

export async function extractContextWithClaude(
  snippets: SearchResult[],
  tipo = "economic"
): Promise<WebContextResult> {
  if (snippets.length === 0) {
    return { disponible: false, indicadores: [] };
  }

  const snippetText = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.url}`)
    .join("\n\n");

  let response;
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system: getSystemPrompt(tipo),
      messages: [{ role: "user", content: snippetText }],
    });
  } catch (err) {
    console.error("[extractContextWithClaude] Anthropic API error", err);
    return { disponible: false, indicadores: [] };
  }

  if (response.stop_reason !== "end_turn") {
    console.error(
      `[extractContextWithClaude] Unexpected stop_reason: ${response.stop_reason}`
    );
    return { disponible: false, indicadores: [] };
  }

  const text =
    response.content.find((b) => b.type === "text")?.text ?? "";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("[extractContextWithClaude] No JSON in output:", text.slice(0, 200));
    return { disponible: false, indicadores: [] };
  }

  try {
    return JSON.parse(match[0]) as WebContextResult;
  } catch {
    console.error("[extractContextWithClaude] JSON parse failed:", match[0].slice(0, 200));
    return { disponible: false, indicadores: [] };
  }
}
