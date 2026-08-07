// lib/moddulo/f3TareasGenerator.ts
// M1 — llamada a Claude que traduce un subconjunto del PIP en asignaciones
// propuestas. Extraído de tareas/generar/route.ts para reutilizarse también
// desde tareas/sincronizar/route.ts (regeneración escopeada solo a los
// PIPItem agregados/editados — las tareas no afectadas por el diff nunca
// pasan por aquí).

import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import { TECNICA_TITULOS, APP_TO_F3_CONTRACTS } from "@/types/f3.types";
import type { TareaPIP, AsignacionCanal, PIPItem } from "@/types/moddulo.types";
import type { TecnicaId } from "@/types/shared.types";

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

type AsignacionClaude = Omit<AsignacionCanal, "asignacionId" | "estadoApp" | "activada">;
interface TareaClaude {
  numero: number; // eco del PIPItem.numero recibido en el prompt — se traduce a pipItemId abajo
  asignaciones: AsignacionClaude[];
}

function parseTareasJSON(raw: string): TareaClaude[] {
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  const s = (fence ? fence[1] : raw).trim();
  const parsed = JSON.parse(s) as { tareas: TareaClaude[] };
  return parsed.tareas;
}

/**
 * Genera las TareaPIP propuestas (M1) para el subconjunto de PIPItem dado —
 * puede ser el PIP completo (primera generación / regeneración total) o
 * solo los ítems agregados/editados (sincronización tras un cambio en F2).
 * `asignacionId`, `estadoApp` y `activada` nunca se confían al modelo — se
 * calculan aquí a partir de `pipItemId` (identidad estable), no de `numero`
 * (número de despliegue, puede cambiar entre generaciones).
 */
export async function generarTareasParaPIPItems(pip: PIPItem[]): Promise<TareaPIP[]> {
  if (pip.length === 0) return [];

  const catalogo = Object.entries(TECNICA_TITULOS)
    .map(([id, titulo]) => `${id}: ${titulo}`)
    .join("\n");

  const system = `Eres M1, el Gestor de tareas de investigación de la Fase 3 (Moddulo). Traduces el Programa de Investigación Profunda (PIP) en un tablero de tareas concretas, evaluando el catálogo completo de 35 técnicas del ecosistema Eskemma (MMEE):

${catalogo}

Para cada ítem del PIP, evalúa en este orden de prioridad:
1. Primero evalúa si alguna técnica del ecosistema aporta, aunque sea parcialmente, a responder la pregunta. Si sí, agrega una asignación { tipo: "primaria", canal: "canal1", tecnicaId, justificacion }. No la fuerces si de verdad ninguna técnica aplica — en ese caso, la primaria puede ser canal2 o canal3 directamente.
2. Después, evalúa si hay una parte de la pregunta que requiere gestión humana directa (entrevistas de élite, negociación, acceso restringido) que ninguna técnica automatizada del ecosistema puede cubrir. Si la hay, agrega SIEMPRE una asignación adicional { tipo: "complementaria", canal: "canal2", justificacion } — nunca omitas esta parte solo porque ya exista una asignación primaria de Canal 1; ambas piezas de evidencia son necesarias.
3. Cada asignación lleva: justificacion (por qué esa asignación cubre esa parte de la pregunta, 1-2 frases), estado siempre "pendiente" en esta propuesta inicial.

No incluyas asignacionId ni estadoApp — esos se calculan automáticamente después.

Ejemplo de referencia: una pregunta sobre viabilidad de una coalición partidista debe generar una asignación primaria a la técnica de monitoreo de medios (T34) para señales públicas, más una asignación complementaria de Canal 2 para entrevistas con dirigencia partidista.

Responde ÚNICAMENTE con JSON: {"tareas": [{"numero": N, "asignaciones": [{"tipo": "primaria"|"complementaria", "canal": "canal1"|"canal2"|"canal3", "tecnicaId": "T##" (solo si canal es canal1), "justificacion": "...", "estado": "pendiente"}]}]}`;

  const user = `PIP heredado de F2:\n${JSON.stringify(pip, null, 2)}`;

  const res = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content: user }],
  }) as Anthropic.Message;
  const raw = extractText(res);

  const tareasClaude = parseTareasJSON(raw);

  // Claude ecoa `numero` (número de despliegue vigente al momento del
  // prompt) para referenciar de vuelta cada PIPItem — se traduce aquí a
  // pipItemId antes de construir la TareaPIP persistible. Fallback
  // posicional si el modelo devolviera un numero que no matchea ninguno
  // del subconjunto enviado (no debería ocurrir, pero no debe tronar).
  const pipPorNumero = new Map(pip.map((p) => [p.numero, p]));

  return tareasClaude.map((t, idx) => {
    const pipItem = pipPorNumero.get(t.numero) ?? pip[idx];
    const pipItemId = pipItem.pipItemId;
    const idsUsados = new Set<string>();
    return {
      pipItemId,
      asignaciones: t.asignaciones.map((a) => {
        // asignacionId se deriva del CONTENIDO de la asignación (pregunta +
        // canal + vía) vía pipItemId, no de numero — dos generaciones
        // distintas del tablero para la misma pregunta con la misma vía
        // producen el mismo ID, sin importar si numero cambió entre medio.
        const base = `${pipItemId}_${a.canal}_${a.tipo}${
          a.canal === "canal1" && a.tecnicaId ? `_${a.tecnicaId}` : ""
        }`;
        let asignacionId = base;
        let sufijo = 1;
        while (idsUsados.has(asignacionId)) {
          asignacionId = `${base}_${sufijo}`;
          sufijo += 1;
        }
        idsUsados.add(asignacionId);
        return {
          ...a,
          asignacionId,
          activada: true,
          ...(a.canal === "canal1" && a.tecnicaId
            ? { estadoApp: APP_TO_F3_CONTRACTS[a.tecnicaId as TecnicaId] ? ("disponible" as const) : ("proximamente" as const) }
            : {}),
        };
      }),
    };
  });
}
