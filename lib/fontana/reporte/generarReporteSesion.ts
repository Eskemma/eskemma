// lib/fontana/reporte/generarReporteSesion.ts
// Worker en BACKGROUND del reporte de sesión de Fontana. Lo dispara
// POST /api/fontana/sesion/[id]/reporte vía `after()` (Next 16,
// maxDuration 300) tras crear el job. NUNCA lanza al caller — marca el job
// `failed` + error y retorna.
//
// Híbrido (Opción C, 26-09-10): construirEsqueletoReporte() arma el markdown
// determinístico completo (cabecera + tablas de cada canvasItem + tablas
// consolidadas de la tabla comparativa). Claude recibe SOLO un resumen
// compacto por sección y devuelve SOLO prosa (JSON: lectura ejecutiva + un
// párrafo por sección "##"). El markdown final se ensambla aquí de forma
// determinística → Claude nunca ve/echa las tablas (garantía estructural de
// que no altera ninguna cifra) y la llamada baja de ~55s a ~23s.
//
// El cuerpo (reporte/actual) y el puntero `reporteSesion` SOLO se escriben
// al completar con éxito — durante una regeneración el reporte anterior
// queda intacto.

import { adminDb } from "@/lib/firebase-admin";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/claude";
import { getProject } from "@/lib/moddulo/project";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { construirEsqueletoReporte, type EsqueletoReporte } from "@/lib/fontana/reporte/reporteSesionSkeleton";
import { resolverCeldasIndicadoresSesion } from "@/lib/fontana/resolverCeldasIndicadoresSesion";
import { marcarReporteJob } from "@/lib/fontana/reporte/reporteJob";
import type { ReporteSesionFontana } from "@/types/fontana.types";

// Límite por indicador dentro de resolverCeldasIndicadoresSesion →
// familia/[id]. El extremo medido (75 indicadores, Oaxaca) lo domina F3-2
// (~62-81s cold); 90s deja pasar el peor caso normal y frena una fuente
// realmente colgada.
const TIMEOUT_INDICADOR_MS = 90_000;

const SYSTEM_PROSA = `Eres el redactor de reportes territoriales de Fontana (consultoría política, Eskemma). Recibes un RESUMEN por secciones de un reporte de sesión: cada sección "##" lista sus indicadores con sus valores ya verificados (de fuentes oficiales) y sus fuentes.

Devuelve SOLO un objeto JSON válido con esta forma exacta, nada más (sin \`\`\`):
{
  "lecturaEjecutiva": "3 a 5 frases sobre el CONJUNTO del reporte",
  "parrafosPorSeccion": { "<título EXACTO de la sección ##>": "4 a 7 frases de lectura de CONJUNTO de esa sección — qué implica para un proyecto político en el territorio, no indicador por indicador" }
}

Reglas:
- Una clave en "parrafosPorSeccion" por CADA sección "##" del resumen, con el título EXACTO (sin el "## ").
- NUNCA inventes una cifra, porcentaje o dato que no esté en el resumen. Si comparas dos valores, hazlo con los números exactos del resumen.
- Cita "(Fuente: X)" al menos una vez por sección, tomando una fuente del resumen.
- Español formal, tono de consultoría. Si usas un término técnico, explícalo en la misma frase.
- Si una sección dice "(sin indicadores en esta sección)", su párrafo puede ser una sola frase que lo reconozca.`;

interface ProsaReporte {
  lecturaEjecutiva: string;
  parrafosPorSeccion: Record<string, string>;
}

// Exportadas SOLO para verificación (scripts/verify-fontana-reporte-async.ts).
export function parsearProsa(texto: string): ProsaReporte | null {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const obj = JSON.parse(limpio) as Partial<ProsaReporte>;
    if (typeof obj.lecturaEjecutiva !== "string" || typeof obj.parrafosPorSeccion !== "object" || !obj.parrafosPorSeccion) {
      return null;
    }
    return { lecturaEjecutiva: obj.lecturaEjecutiva, parrafosPorSeccion: obj.parrafosPorSeccion as Record<string, string> };
  } catch {
    return null;
  }
}

/**
 * Ensambla el markdown final: cabecera + prosa + tablas determinísticas.
 * Exportada SOLO para verificación (scripts/verify-fontana-reporte-async.ts).
 */
export function ensamblar(esqueleto: EsqueletoReporte, prosa: ProsaReporte | null): string {
  if (!prosa) return esqueleto.markdownEsqueleto; // fallback determinístico
  const partes: string[] = [esqueleto.cabecera];
  if (prosa.lecturaEjecutiva.trim()) partes.push(prosa.lecturaEjecutiva.trim());
  for (const bloque of esqueleto.bloques) {
    const parrafo = (prosa.parrafosPorSeccion[bloque.titulo] ?? "").trim();
    partes.push([`## ${bloque.titulo}`, parrafo, bloque.markdown].filter(Boolean).join("\n\n"));
  }
  return partes.join("\n\n");
}

/**
 * Genera y persiste el reporte de sesión, actualizando el job. NUNCA lanza.
 */
export async function generarReporteSesion(
  sesionId: string,
  uid: string,
  fetchCtx: { cookie: string; baseUrl: string }
): Promise<void> {
  try {
    await marcarReporteJob(sesionId, { status: "running" });

    const cargada = await cargarSesionConTerritorioActual(sesionId, uid);
    if (!cargada) {
      await marcarReporteJob(sesionId, {
        status: "failed",
        error: "No se encontró la sesión.",
        completedAt: new Date().toISOString(),
      });
      return;
    }
    const { sesion, ref } = cargada;

    // Nombre del proyecto (título) + celdas crudas de la tabla comparativa
    // (con timeout por indicador). Ambas best-effort.
    const [nombreProyecto, indicadoresTabla] = await Promise.all([
      sesion.modduloProjectId
        ? getProject(sesion.modduloProjectId, uid).then((p) => p?.name).catch(() => undefined)
        : Promise.resolve(undefined),
      resolverCeldasIndicadoresSesion(sesion, { ...fetchCtx, timeoutMs: TIMEOUT_INDICADOR_MS }).catch((err) => {
        console.error("[fontana/reporte] resolverCeldasIndicadoresSesion falló:", err);
        return [] as Awaited<ReturnType<typeof resolverCeldasIndicadoresSesion>>;
      }),
    ]);

    const esqueleto = construirEsqueletoReporte(sesion, nombreProyecto, indicadoresTabla);
    if (!esqueleto.hayContenido) {
      await marcarReporteJob(sesionId, {
        status: "failed",
        error: "Esta sesión no tiene indicadores (ni en el Canvas ni en la tabla comparativa).",
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Claude — SOLO prosa.
    let prosa: ProsaReporte | null = null;
    try {
      const msg = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 3000,
        system: SYSTEM_PROSA,
        messages: [{ role: "user", content: esqueleto.resumenProsa }],
      });
      const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      prosa = parsearProsa(texto);
      if (!prosa) console.warn("[fontana/reporte] prosa no parseable — fallback determinístico");
    } catch (err) {
      console.error("[fontana/reporte] llamada a Claude falló — fallback determinístico:", err);
    }

    const contenidoMarkdown = ensamblar(esqueleto, prosa);
    const generadoEn = new Date().toISOString();
    const reporte: ReporteSesionFontana = {
      contenidoMarkdown,
      generadoEn,
      origen: esqueleto.origen,
      secciones: esqueleto.secciones,
      canvasItemsRef: esqueleto.canvasItemsRef,
    };

    // Escritura atómica: cuerpo + puntero + job completado.
    const batch = adminDb.batch();
    batch.set(ref.collection("reporte").doc("actual"), reporte);
    batch.update(ref, {
      reporteSesion: { generadoEn, canvasItemsRef: esqueleto.canvasItemsRef },
      fechaUltimoGuardado: generadoEn,
    });
    batch.set(
      ref.collection("reporte").doc("job"),
      { status: "completed", completedAt: generadoEn },
      { merge: true }
    );
    await batch.commit();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    console.error("[fontana/reporte] Error en el job:", msg, err);
    await marcarReporteJob(sesionId, {
      status: "failed",
      error: "No se pudo generar el reporte. Vuelve a intentarlo.",
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}
