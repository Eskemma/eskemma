// app/api/fontana/chat/route.ts
// POST — chat SSE del agente conversacional "Fontana" (T10). Tool use
// real del SDK de Anthropic (consultar_indicador / generar_visualizacion
// / navegar_pestana). Streaming manual vía ReadableStream, mismo patrón
// que app/api/moddulo/chat/[phaseId]/route.ts.
//
// El agente SOLO responde con datos que devuelve una herramienta — el
// system prompt (lib/fontana/agente/systemPrompt.ts) lo obliga. Las
// herramientas consumen los endpoints ya existentes de Fontana, nunca
// una fuente paralela (ver lib/fontana/agente/tools.ts).
//
// Persistencia: mensajes en la subcolección append-only
// fontana_sesiones/{sesionId}/mensajes; los items de Canvas los escribe
// el propio ejecutor de la herramienta en fontana_sesiones/{id}.canvasItems.

import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { construirSystemPromptFontana } from "@/lib/fontana/agente/systemPrompt";
import { FONTANA_TOOLS, ejecutarHerramienta, type ToolContext } from "@/lib/fontana/agente/tools";
import { limpiarUndefined } from "@/lib/fontana/agente/canvasBuilder";
import { construirBloqueAdjuntos } from "@/lib/fontana/agente/adjuntosContexto";
import { adminDb } from "@/lib/firebase-admin";
import type { FontanaChatMessage, FontanaToolCall } from "@/types/fontana.types";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const MAX_ITERACIONES = 5;

// Guard anti-alucinación de tool call (26-09-04, incidente Cuernavaca): el
// modelo produjo un turno completo afirmando haber generado una pirámide
// ("genero ahora", "ya está en tu Canvas", "aquí la lectura") SIN llamar a
// ninguna herramienta. Genérico: si al cerrar el turno NO hubo NINGUNA tool
// call y el texto final afirma un resultado (dato consultado, algo generado,
// un valor "en la mano", algo en el Canvas), se descarta ese texto y se
// fuerza una iteración de corrección. Distinto de text_suppress (que solo
// borra narración de proceso ENTRE tool calls).
const AFIRMA_RESULTADO =
  /\b(ya (está|estan|están|quedó|quedo|lo tienes|la tienes|las tienes|los tienes)|aqu[íi] (tienes|está|esta|van|la lectura|el |los |las )|en (tu|el) canvas|al canvas|gener[éeó]|generad[oa]s?|agregu[éeó]|añad[íi]|añadid[oa]s?|cre[éeó](?! (una|la|el|los)? ?(gráfica|grafica|tabla|serie|pirámide|piramide) (si|cuando))|consult[éeó]|obtuve|calcul[éeó]|revis[éeó]|seg[úu]n (la herramienta|los datos|el resultado|lo consultado)|(el|los|la|las) (dato|datos|valor|valores|resultado|resultados|cifra|cifras)\s+(es|son|de|da|dan|arroja|arrojan|indican?)\b)/i;

const AVISO_SIN_HERRAMIENTAS =
  "[verificación del sistema] En este turno NO ejecutaste ninguna herramienta: no tienes ningún dato, valor, gráfica, tabla ni visualización que reportar como resultado, y nada quedó en el Canvas. Reescribe tu respuesta desde cero: si necesitas un dato o una visualización, LLAMA ahora a la herramienta que corresponda; si no puedes, dile al usuario en una frase qué hace falta. Prohibido afirmar haber consultado, generado, calculado, obtenido o dejado algo.";

// Guard "vocabulario de indisponibilidad sin respaldo" (26-09-05, incidente
// Iztapalapa): el modelo explicó por qué una serie municipal "no estaba
// disponible" usando vocabulario ("el conector no está activo", "función
// pendiente") que NO venía de ningún resultado real de herramienta — lo
// tomó de disponibilidadTemporal de OTRO indicador/momento de la
// conversación (o lo inventó por analogía), en vez de reportar el `motivo`
// real que devolvió consultar_serie_temporal/generar_visualizacion para
// ESE territorio. Mismo principio que AFIRMA_RESULTADO: no confiar en que
// el modelo narre solo con datos reales — verificarlo contra lo que las
// herramientas de ESTE turno realmente devolvieron. Si el texto final usa
// este vocabulario y NINGÚN resultado de herramienta de este turno lo
// contiene, se descarta y se fuerza una corrección.
//
// ⚠️ COBERTURA INCREMENTAL, NO PROBLEMA CERRADO (26-09-07): 2ª repetición
// confirmada del mismo patrón — Puebla/Querétaro en SESNSP, el modelo
// afirmó "SESNSP no desagrega a nivel de municipio capital para esas
// entidades" (falso: SESNSP SÍ tiene el dato — 35,509 y 32,601 carpetas
// reales, verificado; la causa real era que comparacion_territorios no
// tenía forma de pedir nivel municipal, ver nivelesPorTerritorio arriba).
// Un guard por lista de frases SIEMPRE va a ir un paso atrás de nuevas
// formas de fabricación con vocabulario distinto — evaluado (2026-09-07)
// invertir en verificación estructural (comparar semánticamente el texto
// final contra el `motivo` real, en vez de una lista de frases) y
// descartado por ahora: sin un LLM-juez adicional (que añade costo,
// latencia, y su propio riesgo de alucinación — no resuelve el problema,
// lo mueve un nivel arriba) no hay forma determinística de detectar
// "esta oración es una explicación causal fabricada" de forma genérica.
// Queda pendiente como mejora estructural futura (ver CLAUDE.md) si el
// patrón se repite una 3ª vez — mientras tanto, esta lista se sigue
// ampliando caso por caso.
const VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO =
  /\b(conectores?|conector(es)?|funci[oó]n(es)? pendiente|no est[aá]n? (activ[oa]s?|conectad[oa]s?)|sin conector|no desagrega|sin desagregaci[oó]n)\b/i;

const AVISO_VOCABULARIO_SIN_RESPALDO =
  "[verificación del sistema] En tu respuesta anterior explicaste que algo \"no está disponible\" o \"no se desagrega\" usando palabras (conector, función pendiente, no está activo/conectado, no desagrega) que NO aparecen en ningún resultado real de herramienta de este turno — probablemente las tomaste de memoria de otro indicador o las inventaste por analogía. Reescribe la explicación usando EXCLUSIVAMENTE el campo `motivo` (u otro texto real) que devolvió la herramienta para ESE indicador y territorio exactos, citado tal cual. Si la herramienta no devolvió una razón, dilo así en vez de inventar una.";

// Guard "nombre de herramienta expuesto" (26-09-06, incidente Iztapalapa
// 2ª ronda): al autocorregirse, el modelo citó el nombre snake_case literal
// de una tool ("La herramienta que consulté (listar_indicadores_activos_todas_familias)...").
// La regla de prompt ya lo prohibía en el flujo normal pero no estaba
// verificada server-side — mismo principio que los demás guards: no confiar
// solo en la instrucción. Chequeo exacto (no regex difusa) contra los
// nombres reales declarados en FONTANA_TOOLS.
const NOMBRES_HERRAMIENTAS = FONTANA_TOOLS.map((t) => t.name);

function contieneNombreHerramienta(texto: string): string | null {
  return NOMBRES_HERRAMIENTAS.find((n) => texto.includes(n)) ?? null;
}

const avisoNombreHerramienta = (nombre: string) =>
  `[verificación del sistema] En tu respuesta anterior mencionaste el nombre interno de una herramienta ("${nombre}") — eso es jerga de implementación, nunca debe llegar al usuario, ni siquiera al explicar o corregir un error tuyo. Reescribe la respuesta sin nombrar ninguna función/herramienta: describe qué información consultaste o qué salió mal en lenguaje llano ("la información que consulté", "lo que revisé"), nunca el nombre técnico.`;

// Guard confirmadoLote (26-09-04, incidente "8 municipios de Jalisco", 2ª
// forma de falla): el modelo trató la respuesta a "¿qué tipo de gráfica
// quieres?" como si confirmara el LOTE DE MUNICIPIOS, poniendo
// confirmadoLote:true desde la primera de 8 llamadas. confirmadoLote solo
// debe honrarse si el último mensaje real del asistente fue genuinamente una
// pregunta sobre CUÁLES/CUÁNTOS municipios — se verifica con dos coincidencias
// independientes (menciona "municipio(s)" Y lenguaje de cantidad/selección),
// nunca confiando en el booleano que reporta el propio modelo.
const RE_MENCIONA_MUNICIPIO = /\bmunicipios?\b/i;
const RE_CANTIDAD_O_SELECCION =
  /\b(cu[aá]l(es)?|cu[aá]nt[oa]s?|todos|todas|en particular|algunos|algunas|alguno)\b/i;

function esPreguntaDeMunicipios(texto: string): boolean {
  return RE_MENCIONA_MUNICIPIO.test(texto) && RE_CANTIDAD_O_SELECCION.test(texto);
}

function ultimoMensajeAssistantReal(history: FontanaChatMessage[] | undefined): string {
  if (!history) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant" && m.id !== "welcome") return m.content ?? "";
  }
  return "";
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

interface ChatBody {
  sesionId?: string;
  message?: string;
  history?: FontanaChatMessage[];
  adjuntoIds?: string[];
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const { sesionId, message } = body;
  if (!sesionId || typeof message !== "string" || !message.trim()) {
    return new Response(JSON.stringify({ error: "sesionId y message son requeridos" }), { status: 400 });
  }
  const adjuntoIds = Array.isArray(body.adjuntoIds)
    ? body.adjuntoIds.filter((x): x is string => typeof x === "string")
    : [];

  const cargada = await cargarSesionConTerritorioActual(sesionId, session.uid);
  if (!cargada) {
    return new Response(JSON.stringify({ error: "Sesión no encontrada" }), { status: 404 });
  }
  const { sesion } = cargada;

  const systemPrompt = construirSystemPromptFontana(sesion.territorio, sesion.tipoProyecto);
  const ultimoMensajeAsistente = ultimoMensajeAssistantReal(body.history);
  const ctx: ToolContext = {
    sesionId,
    uid: session.uid,
    cookie: request.headers.get("cookie") ?? "",
    baseUrl: request.nextUrl.origin,
    territorio: sesion.territorio,
    tipoProyecto: sesion.tipoProyecto,
    vizTerritoriosDelTurno: new Set<string>(),
    municipiosPreguntadosPrevio: esPreguntaDeMunicipios(ultimoMensajeAsistente),
    ultimoMensajeUsuario: message,
    ultimoMensajeAsistente,
    canvasItemsSesion: sesion.canvasItems ? [...sesion.canvasItems] : [],
  };

  const historial: Anthropic.MessageParam[] = (body.history ?? [])
    .filter((m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content }));

  // Texto de los archivos que el usuario adjuntó a la sesión — contexto
  // crudo, no una herramienta. Se antepone al turno del usuario. Ver
  // lib/fontana/agente/adjuntosContexto.ts y el bloque "## Archivos
  // adjuntos por el usuario" del system prompt.
  const bloqueAdjuntos = await construirBloqueAdjuntos(sesionId, adjuntoIds);
  const contenidoTurno = bloqueAdjuntos
    ? `${bloqueAdjuntos}\n\n---\n\n${message}`
    : message;

  const mensajes: Anthropic.MessageParam[] = [
    ...historial,
    { role: "user", content: contenidoTurno },
  ];

  const nowIso = () => new Date().toISOString();
  const userMessage: FontanaChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: message,
    timestamp: nowIso(),
    ...(adjuntoIds.length > 0 ? { adjuntoIds } : {}),
  };
  const assistantMessageId = crypto.randomUUID();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const toolCallsAcum: FontanaToolCall[] = [];
      const toolResultTextsAcum: string[] = [];
      const canvasItemIds: string[] = [];
      let fullText = "";
      let correccionAlucinacionHecha = false;
      let correccionVocabularioHecha = false;
      let correccionNombreHerramientaHecha = false;

      try {
        for (let i = 0; i < MAX_ITERACIONES; i++) {
          const llmStream = anthropic.messages.stream({
            model: CLAUDE_MODEL,
            // > budget_tokens; el informe visible cabe de sobra en el resto.
            max_tokens: 6000,
            // Razonamiento privado: el modelo verifica su aritmética y se
            // autocorrige AQUÍ, no en el texto que ve el usuario. El filtro
            // de abajo solo reenvía `text_delta` — los `thinking_delta` /
            // `signature_delta` nunca llegan al cliente. Los bloques
            // `thinking` firmados viajan en finalMsg.content y se
            // re-inyectan íntegros en el loop de tool-use (la API los exige
            // dentro del mismo turno; entre turnos el `history` del cliente
            // es texto plano, no se acumulan).
            thinking: { type: "enabled", budget_tokens: 2000 },
            system: systemPrompt,
            messages: mensajes,
            tools: FONTANA_TOOLS,
          });

          // Texto de ESTA iteración — se stringea optimista, pero si la
          // iteración resulta intermedia (stop_reason "tool_use") se
          // descarta: el usuario nunca ve narración entre herramientas
          // ("primero déjame ver…", "ahora consulto…"), pase lo que pase.
          let textoIter = "";
          for await (const ev of llmStream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              textoIter += ev.delta.text;
              send({ type: "text", content: ev.delta.text });
            }
          }

          const finalMsg = await llmStream.finalMessage();
          mensajes.push({ role: "assistant", content: finalMsg.content });

          const terminaTurno = finalMsg.stop_reason !== "tool_use";

          // Guard anti-alucinación: el modelo cierra el turno SIN haber
          // llamado NINGUNA herramienta pero afirma un resultado. Se descarta
          // ese texto y se fuerza UNA iteración de corrección.
          if (
            terminaTurno &&
            toolCallsAcum.length === 0 &&
            !correccionAlucinacionHecha &&
            AFIRMA_RESULTADO.test(textoIter)
          ) {
            correccionAlucinacionHecha = true;
            if (textoIter) send({ type: "text_suppress" });
            mensajes.push({ role: "user", content: AVISO_SIN_HERRAMIENTAS });
            continue;
          }

          // Guard vocabulario sin respaldo: el texto final usa lenguaje de
          // "conector"/"función pendiente" que ningún resultado real de
          // herramienta de este turno contiene.
          if (
            terminaTurno &&
            !correccionVocabularioHecha &&
            VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO.test(textoIter) &&
            !toolResultTextsAcum.some((t) => VOCABULARIO_NO_DISPONIBLE_SIN_RESPALDO.test(t))
          ) {
            correccionVocabularioHecha = true;
            if (textoIter) send({ type: "text_suppress" });
            mensajes.push({ role: "user", content: AVISO_VOCABULARIO_SIN_RESPALDO });
            continue;
          }

          // Guard nombre de herramienta expuesto: el texto final cita el
          // nombre snake_case literal de una tool (jerga interna).
          const herramientaExpuesta = terminaTurno ? contieneNombreHerramienta(textoIter) : null;
          if (herramientaExpuesta && !correccionNombreHerramientaHecha) {
            correccionNombreHerramientaHecha = true;
            if (textoIter) send({ type: "text_suppress" });
            mensajes.push({ role: "user", content: avisoNombreHerramienta(herramientaExpuesta) });
            continue;
          }

          const esFinal = terminaTurno || i === MAX_ITERACIONES - 1;
          if (esFinal) {
            fullText += textoIter;
          } else if (textoIter) {
            // Iteración intermedia con texto → era narración de proceso.
            // Se le dice al cliente que borre lo que streameó este turno.
            send({ type: "text_suppress" });
          }

          if (terminaTurno) break;

          const toolUses = finalMsg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const tu of toolUses) {
            send({ type: "tool_call", tool: tu.name, input: tu.input });
            const r = await ejecutarHerramienta(
              tu.name,
              (tu.input ?? {}) as Record<string, unknown>,
              ctx,
              assistantMessageId
            );
            toolCallsAcum.push(r.toolCall);
            if (r.navEvent) send({ type: "nav", ...r.navEvent });
            if (r.canvasItem) {
              canvasItemIds.push(r.canvasItem.id);
              send({ type: "canvas_item", item: r.canvasItem });
            }
            const resultTexto = JSON.stringify(r.resultForModel);
            toolResultTextsAcum.push(resultTexto);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: resultTexto,
            });
          }

          mensajes.push({ role: "user", content: toolResults });

          if (i === MAX_ITERACIONES - 1) {
            const aviso =
              "\n\n(Alcancé el límite de pasos para esta consulta. Si necesitas más detalle, hazme una pregunta más específica.)";
            fullText += aviso;
            send({ type: "text", content: aviso });
          }
        }

        const assistantMessage: FontanaChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: fullText,
          timestamp: nowIso(),
          ...(toolCallsAcum.length > 0 ? { toolCalls: toolCallsAcum } : {}),
          ...(canvasItemIds.length > 0 ? { canvasItemIds } : {}),
        };

        const col = adminDb.collection("fontana_sesiones").doc(sesionId).collection("mensajes");
        // limpiarUndefined por defensa en profundidad: FontanaToolCall.input
        // viene JSON-parseado del SDK (sin undefined), pero está tipado
        // Record<string, unknown> y pasa por varias capas — mismo criterio
        // que canvasItems (Firestore Admin rechaza undefined).
        await Promise.all([
          col.doc(userMessage.id).set(limpiarUndefined(userMessage)),
          col.doc(assistantMessage.id).set(limpiarUndefined(assistantMessage)),
        ]);

        send({ type: "done", mensajeId: assistantMessage.id });
      } catch (err) {
        const detalle = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error("[fontana/chat] Error:", detalle, err instanceof Error ? err.stack : "");
        send({
          type: "error",
          message: "Hubo un problema al procesar tu mensaje. Intenta de nuevo.",
          ...(process.env.NODE_ENV === "development" ? { detalle } : {}),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
