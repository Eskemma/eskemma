// lib/ai/phases/prompts.test.ts
// Regresión de las reglas "LÍMITES DE TU INFORMACIÓN" (forense 26-09-18): el
// chat inventó una causa técnica ("la integración Moddulo–Sefix debe habilitarla
// el administrador") y dio un dato institucional equivocado con total
// naturalidad. Viven en el prompt base compartido, así que deben estar en
// TODAS las fases con chat (proposito, exploracion, investigacion).

import { describe, expect, it } from "vitest";
import { getPhaseSystemPrompt } from "./prompts";
import { PHASE_ORDER } from "@/types/moddulo.types";

const FASES_CON_CHAT = ["proposito", "exploracion", "investigacion"] as const;

describe("prompt base — LÍMITES DE TU INFORMACIÓN", () => {
  it.each(FASES_CON_CHAT)("fase %s: prohíbe inventar la causa técnica y exige decir 'no tengo ese dato'", (fase) => {
    const prompt = getPhaseSystemPrompt(fase);
    expect(prompt).toContain("LÍMITES DE TU INFORMACIÓN — REGLA ABSOLUTA");
    expect(prompt).toContain('"no tengo ese dato en este momento"');
    expect(prompt).toContain("NUNCA inventes una causa técnica");
    expect(prompt).toContain("lo habilita el administrador");
  });

  it.each(FASES_CON_CHAT)("fase %s: los datos propios no verificados se señalan como tales, sin URLs inventadas", (fase) => {
    const prompt = getPhaseSystemPrompt(fase);
    expect(prompt).toContain("NUNCA presentes como dato verificado");
    expect(prompt).toContain("conocimiento general mío, no lo he verificado");
    expect(prompt).toContain("NUNCA inventes direcciones web");
  });

  it.each(FASES_CON_CHAT)("fase %s: precisión de cifras y fechas en el bloque JSON", (fase) => {
    expect(getPhaseSystemPrompt(fase)).toContain("si dio mes y año, no agregues un día");
  });

  it("está en el prompt base: las 9 fases lo heredan", () => {
    for (const fase of PHASE_ORDER) {
      expect(getPhaseSystemPrompt(fase)).toContain("LÍMITES DE TU INFORMACIÓN — REGLA ABSOLUTA");
    }
  });

  it("no rompe la regla existente de adjuntos de F1 (mismo estilo imperativo)", () => {
    expect(getPhaseSystemPrompt("proposito")).toContain('NUNCA digas que "no tienes acceso a archivos adjuntos"');
  });
});

// ─── Paso 4a (26-09-26): bloque de territorio como sección ADICIONAL ───────────────────────────────
// Baseline generado con el código anterior al cambio (fecha fija, 9 fases, con y sin contexto).
import { afterAll, beforeAll, vi } from "vitest";
import baseline from "./__fixtures__/prompts-antes-4a.json";
import type { Territorio } from "@/types/shared.types";
import { bloqueTerritorioModdulo } from "@/lib/geo/bloqueTerritorio";

const FRASE_F2_ANTES =
  "Infiere el país, estado o territorio a partir del XPCTO (sujeto, hito, contexto del proyecto).";
const FRASE_F2_AHORA =
  "Si el prompt incluye el bloque «TERRITORIO DEL PROYECTO», ese es el territorio: úsalo tal cual. Solo si NO existe ese bloque, infiere el país, estado o territorio a partir del XPCTO (sujeto, hito, contexto del proyecto).";


// T8b: bloque de las dos vías de F2 (literales PROPIOS del test: no se importan de prompts.ts). Solo cambia `exploracion`.
const VIAS_F2_ANTES = `LAS DOS VÍAS PARA EL ANÁLISIS DE F2:
1. Análisis de contexto express: el sistema genera el mapa PEST-L completo a partir del XPCTO y los documentos disponibles. El consultor no necesita construirlo en el chat.
2. App PESTEL en Centinela: análisis estructurado con variables, fuentes e informes. El resultado se importa a F2 automáticamente.

INTEGRACIÓN BIDIRECCIONAL F2 ↔ PESTEL:
- F2 → PESTEL: El botón "Abrir PESTEL" (en la barra de esta pantalla) lanza un proyecto PESTEL pre-llenado. Los documentos compartidos en F2 se cargan automáticamente en la Etapa de Datos de PESTEL.
- PESTEL → F2: Un análisis completado en PESTEL se importa a F2 con las 6 dimensiones como señales tripartitas.
`;
const VIAS_F2_AHORA = `LAS DOS VÍAS PARA EL ANÁLISIS DE F2:
1. Análisis de contexto express: el sistema genera el mapa PEST-L completo a partir del XPCTO y los documentos disponibles. El consultor no necesita construirlo en el chat.
2. App PESTEL en Centinela: análisis estructurado con variables, fuentes e informes. Su resultado no llega solo a F2: se trae desde Centinela.

CÓMO SE CONECTAN F2 Y LA APP PESTEL:
- Empezar: (a) sin análisis, botón "Abrir PESTEL" debajo del chat; (b) con un análisis express ya hecho, menú ⋮ → "Analizar con PESTEL"; (c) con un análisis importado o un proyecto PESTEL en preparación (creado desde aquí y aún sin importar), "Regresar a PESTEL →" en la barra "Análisis por motores" (y debajo del chat si se ve el estado de chat).
- Documentos: los que el consultor comparta aquí se cargan en la etapa de Datos de PESTEL la primera vez que abre esa etapa; los que comparta después no se agregan solos.
- Traer el análisis a F2: en Centinela, botón "Regresar a Moddulo F2 con resultados". Si el análisis no está aprobado, tiene sesgos sin revisar o ya no es el vigente, se pide confirmación antes de importarlo.
- F1-Propósito: con un análisis importado y F1 sin completar, F2 muestra una invitación con el botón "Ir a F1-Propósito →". No bloquea, pero sin F1 el contraste con el XPCTO queda genérico.
- Ajustes: un análisis de Centinela se ajusta en Centinela y se vuelve a importar; lo que se edite en F2 no regresa a Centinela. El análisis express se edita aquí ("Editar narrativas" con el análisis aprobado, o "Nuevo análisis").
- Nunca digas que algo se importa automáticamente ni inventes nombres de botones.
`;
const B_F2_ANTES = `B) Si el consultor dice que quiere usar la App PESTEL (frases como "quiero usar PESTEL", "prefiero Centinela", "¿cómo abro el análisis?", "quiero el análisis estructurado", o cualquier variante que indique preferencia por la app):
   → Responde en máximo 3 oraciones:
     1. Confirma la elección.
     2. Indica que debe hacer clic en "Abrir PESTEL" en la barra de botones de esta pantalla.
     3. Si compartió documentos, confirma que se cargarán automáticamente en el proyecto PESTEL.
   → NO construyas el PEST-L en el chat cuando el consultor eligió la App PESTEL.
   Ejemplo: "Perfecto. Haz clic en 'Abrir PESTEL' en la barra de esta pantalla para configurar el análisis. Los documentos que compartiste se cargarán automáticamente en la Etapa de Datos del proyecto PESTEL."
`;
const B_F2_AHORA = `B) Si el consultor dice que quiere usar la App PESTEL (frases como "quiero usar PESTEL", "prefiero Centinela", "¿cómo abro el análisis?", "quiero el análisis estructurado", o cualquier variante que indique preferencia por la app):
   → Responde en máximo 3 oraciones:
     1. Confirma la elección.
     2. Indica cómo abrirla: botón "Abrir PESTEL" debajo del chat; si ya hay un análisis express hecho, menú ⋮ → "Analizar con PESTEL"; si ya hay uno de Centinela, "Regresar a PESTEL →".
     3. Si compartió documentos, confirma que se cargarán en la etapa de Datos del proyecto PESTEL al abrirla.
   → NO construyas el PEST-L en el chat cuando el consultor eligió la App PESTEL.
   Ejemplo: "Perfecto. Haz clic en 'Abrir PESTEL' debajo del chat para configurar el análisis. Los documentos que compartiste se cargarán en la etapa de Datos del proyecto PESTEL cuando la abras."
`;
const f2Ahora = (t: string) => t.replace(FRASE_F2_ANTES, FRASE_F2_AHORA).replace(VIAS_F2_ANTES, VIAS_F2_AHORA).replace(B_F2_ANTES, B_F2_AHORA);

const TERR: Territorio = {
  nivel: "distrito_federal",
  nombre: "PROGRESO",
  estado: "Yucatán",
  pais: "México",
  distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }],
};

describe("Paso 4a — el bloque de territorio no desplaza la guía de ninguna fase", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it.each(PHASE_ORDER)("fase %s: SIN territorio el prompt es idéntico byte a byte al anterior", (fase) => {
    const antes = baseline.sinContexto[fase as keyof typeof baseline.sinContexto];
    const esperado = fase === "exploracion" ? f2Ahora(antes) : antes;
    expect(getPhaseSystemPrompt(fase)).toBe(esperado);
    expect(getPhaseSystemPrompt(fase, undefined, undefined, null)).toBe(esperado);
    const conCtx = baseline.conContexto[fase as keyof typeof baseline.conContexto];
    expect(getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" })).toBe(
      fase === "exploracion" ? f2Ahora(conCtx) : conCtx
    );
  });

  it.each(PHASE_ORDER)("fase %s: CON territorio es superset — solo se inserta el bloque tras el XPCTO", (fase) => {
    const sin = getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" });
    const con = getPhaseSystemPrompt(fase, { campo: "valor" }, { hito: "h", sujeto: "s" }, TERR);
    const bloque = bloqueTerritorioModdulo(TERR);
    expect(bloque.length).toBeGreaterThan(0);
    // Quitar el bloque insertado reproduce el prompt sin territorio: nada se acortó ni se reemplazó.
    expect(con.replace(`\n\n${bloque}`, "")).toBe(sin);
    // Orden: XPCTO → TERRITORIO → datos capturados (guía y RAE quedan antes/aparte).
    const iXpcto = con.indexOf("CONTEXTO DEL PROYECTO — XPCTO");
    const iTerr = con.indexOf("TERRITORIO DEL PROYECTO (dato estructurado");
    const iDatos = con.indexOf("DADOS YA CAPTURADOS EN ESTA FASE");
    expect(iXpcto).toBeGreaterThan(0);
    expect(iTerr).toBeGreaterThan(iXpcto);
    expect(iDatos).toBeGreaterThan(iTerr);
  });

  it("el bloque es pequeño frente al prompt base de cada fase (< 12 %)", () => {
    for (const fase of PHASE_ORDER) {
      const sin = getPhaseSystemPrompt(fase);
      const extra = getPhaseSystemPrompt(fase, undefined, undefined, TERR).length - sin.length;
      expect(extra / sin.length).toBeLessThan(0.12);
    }
  });

  it("F2 ya no ordena inferir el territorio si existe el bloque", () => {
    expect(getPhaseSystemPrompt("exploracion")).toContain("Solo si NO existe ese bloque, infiere");
  });
});
