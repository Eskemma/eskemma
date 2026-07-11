// app/api/moddulo/projects/[projectId]/generate-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { buildPhaseContext } from "@/lib/moddulo/knowledge-injector";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import type { PhaseId, XPCTO, Dictamen } from "@/types/moddulo.types";

interface GenerateReportBody {
  phaseId: PhaseId;
  xpcto: Partial<XPCTO>;
  projectName?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { projectId } = await params;
    const body: GenerateReportBody = await request.json();
    const { phaseId, xpcto, projectName } = body;

    const project = await getProject(projectId, session.uid);
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const fecha = new Date().toLocaleDateString("es-MX", {
      year: "numeric", month: "long", day: "numeric",
    });

    const prompt = buildReportPrompt(phaseId, xpcto, projectName ?? project.name, fecha);

    const knowledgeContext = await buildPhaseContext({
      phaseId,
      projectType: project.type,
    });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      ...(knowledgeContext ? { system: knowledgeContext } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // For proposito: Claude returns JSON with {reportText, dictamen}
    if (phaseId === "proposito") {
      let reportText = rawText;
      let dictamen: Dictamen | null = null;

      try {
        // Strip markdown code fences that Claude sometimes adds despite instructions
        let jsonToParse = rawText.trim();
        const fenceMatch = jsonToParse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
        if (fenceMatch) jsonToParse = fenceMatch[1].trim();

        const parsed = JSON.parse(jsonToParse) as { reportText: string; dictamen: Dictamen };
        if (parsed.reportText && typeof parsed.reportText === "string") {
          reportText = parsed.reportText;
        }
        dictamen = parsed.dictamen ?? null;
      } catch {
        // Fallback: treat entire response as reportText, no dictamen
        reportText = rawText;
      }

      const firestoreUpdates: Record<string, unknown> = {
        [`phases.${phaseId}.reportText`]: reportText,
        [`phases.${phaseId}.reportGeneratedAt`]: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (dictamen) {
        firestoreUpdates[`phases.${phaseId}.dictamen`] = dictamen;
      }

      await adminDb.collection("moddulo_projects").doc(projectId).update(firestoreUpdates);

      return NextResponse.json({ reportText, dictamen });
    }

    // Other phases: plain text report
    await adminDb.collection("moddulo_projects").doc(projectId).update({
      [`phases.${phaseId}.reportText`]: rawText,
      [`phases.${phaseId}.reportGeneratedAt`]: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ reportText: rawText });
  } catch (error) {
    console.error("[generate-report] Error:", error);
    return NextResponse.json({ error: "Error al generar el reporte" }, { status: 500 });
  }
}

function buildReportPrompt(
  phaseId: PhaseId,
  xpcto: Partial<XPCTO>,
  projectName: string,
  fecha: string
): string {
  if (phaseId !== "proposito") {
    return `Genera un resumen diagnóstico de la fase ${phaseId} del proyecto "${projectName}". Fecha: ${fecha}.`;
  }

  return `Eres Moddulo, el copiloto estratégico de Eskemma. Tu tarea es generar el REPORTE DIAGNÓSTICO COMPLETO de la Fase 1 — Propósito y el DICTAMEN DE COHERENCIA XPCTO para el siguiente proyecto.

Proyecto: ${projectName}
Fecha: ${fecha}
Tipo de proyecto: ${xpcto && "tipo" in xpcto ? String((xpcto as Record<string, unknown>).tipo) : "No especificado"}

VARIABLES XPCTO DEFINIDAS:
- X (Hito): ${xpcto.hito ?? "No definido"}
- P (Sujeto): ${xpcto.sujeto ?? "No definido"}
- C (Capacidades):
  · Financiero: ${xpcto.capacidades?.financiero ?? "No definido"}
  · Humano: ${xpcto.capacidades?.humano ?? "No definido"}
  · Logístico: ${xpcto.capacidades?.logistico ?? "No definido"}
- T (Tiempo): Fecha límite ${xpcto.tiempo?.fechaLimite ?? "No definida"} (${xpcto.tiempo?.duracionMeses ?? 0} meses desde hoy)
- O (Justificación): ${xpcto.justificacion ?? "No definida"}

INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin bloques de código markdown. El JSON debe tener exactamente dos campos: "reportText" (string con el reporte en markdown) y "dictamen" (objeto con los 5 cruces de validación).

Formato requerido:
{
  "reportText": "...(markdown del reporte)...",
  "dictamen": {
    "cruces": [
      {
        "id": 1,
        "etiqueta": "Cruce 1 · X ↔ T",
        "pregunta": "¿El hito es alcanzable en el tiempo disponible?",
        "veredicto": "coherente",
        "argumentacion": "..."
      },
      {
        "id": 2,
        "etiqueta": "Cruce 2 · X ↔ C",
        "pregunta": "¿Las capacidades son suficientes para la magnitud del hito?",
        "veredicto": "coherente",
        "argumentacion": "..."
      },
      {
        "id": 3,
        "etiqueta": "Cruce 3 · P ↔ O",
        "pregunta": "¿La autoridad moral del sujeto es coherente con la justificación?",
        "veredicto": "coherente",
        "argumentacion": "..."
      },
      {
        "id": 4,
        "etiqueta": "Cruce 4 · O ↔ X",
        "pregunta": "¿El propósito superior justifica el esfuerzo del hito?",
        "veredicto": "coherente",
        "argumentacion": "..."
      },
      {
        "id": 5,
        "etiqueta": "Cruce 5 · XPCTO ↔ Tipo",
        "pregunta": "¿Las variables son consistentes con el tipo de proyecto?",
        "veredicto": "coherente",
        "argumentacion": "..."
      }
    ]
  }
}

Los valores de "veredicto" deben ser exactamente "coherente" o "requiere_ajuste".
La "argumentacion" de cada cruce debe ser específica al proyecto, entre 2 y 4 oraciones.

El campo "reportText" debe contener este reporte en markdown:

# REPORTE DIAGNÓSTICO — FASE 1: PROPÓSITO
## ${projectName}
*Generado el ${fecha}*

---

## VARIABLES XPCTO — ESTADO Y LECTURA ESTRATÉGICA

### X — HITO
[El hito tal como fue definido]

**Lectura estratégica:** [Análisis de 3-5 oraciones sobre la solidez y viabilidad del hito]

---

### P — SUJETO
[El sujeto tal como fue definido]

**Lectura estratégica:** [Análisis del perfil político: fortalezas, activos, riesgos]

---

### C — CAPACIDADES

| Dimensión | Disponible | Nivel de riesgo |
|---|---|---|
| Financiero | [dato] | [✅ Sólido / ⚠️ Ajustado / 🔴 Crítico] |
| Humano | [dato] | [✅ Sólido / ⚠️ Ajustado / 🔴 Crítico] |
| Logístico | [dato] | [✅ Sólido / ⚠️ Ajustado / 🔴 Crítico] |

**Lectura estratégica:** [Análisis integrado de las tres dimensiones de capacidad]

---

### T — TIEMPO
**Fecha límite:** [fecha]
**Horizonte real:** ~[N] meses

**Lectura estratégica:** [Análisis del tiempo disponible: ¿es suficiente? ¿qué implica para la planificación?]

---

### O — JUSTIFICACIÓN
[La justificación tal como fue definida]

**Lectura estratégica:** [Análisis de la solidez ética y narrativa del propósito]

---

## DIAGNÓSTICO GENERAL

| Variable | Estado | Observación |
|---|---|---|
| Hito (X) | [✅/⚠️/🔴] [Sólido/Funcional/Débil] | [síntesis en una línea] |
| Sujeto (P) | [✅/⚠️/🔴] | [síntesis en una línea] |
| Capacidades (C) | [✅/⚠️/🔴] | [síntesis en una línea] |
| Tiempo (T) | [✅/⚠️/🔴] | [síntesis en una línea] |
| Justificación (O) | [✅/⚠️/🔴] | [síntesis en una línea] |

**Semáforo de integridad:** [🟢 Verde / 🟡 Amarillo / 🔴 Rojo]

---

## IMPLICACIONES PARA LAS SIGUIENTES FASES

[3-5 puntos concretos sobre qué debe atenderse en Exploración, Investigación y Diagnóstico basándose en las fortalezas y riesgos identificados en el XPCTO]

Sé preciso, directo y estratégico. No uses frases genéricas. Basa cada análisis en los datos específicos del proyecto.

FORMATO NUMÉRICO: Al citar o mencionar cifras en el reporte, usa siempre la convención mexicana: coma para miles (ej. "1,000 voluntarios", "2,500,000 pesos"), punto para decimales. Si el dato original usa punto como separador de miles (ej. "1.000"), normalízalo a "1,000" antes de citarlo.

Recuerda: responde ÚNICAMENTE con el objeto JSON, sin ningún texto adicional.`;
}
