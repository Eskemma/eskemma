/**
 * scripts/verify-fontana-reporte-async.ts
 * Verificación determinística (sin servidor Next ni Firestore) de la
 * arquitectura ASÍNCRONA del reporte de sesión de Fontana:
 *
 *  1. Opción C — construirEsqueletoReporte arma cabecera + bloques +
 *     resumenProsa; ensamblar() intercala la prosa SIN perder ni una fila
 *     de tabla; fallback determinístico si la prosa es null.
 *  2. parsearProsa — tolera fences ```json, rechaza formas inválidas.
 *  3. jobEnCurso — pending / running fresco → en curso; running colgado /
 *     completed / failed / null → NO en curso (base de la idempotencia:
 *     un 2º POST dentro de la ventana reusa el job, no crea otro).
 *  4. MOTIVO_TIMEOUT_REPORTE — texto específico de timeout, distinguible
 *     de un "sin dato para este territorio".
 *
 * Usage: npx tsx scripts/verify-fontana-reporte-async.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import type { FontanaSesion, FontanaCanvasItem, FontanaContextoTerritorial } from "../types/fontana.types";

let fail = 0;
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? "  ✅" : "  ❌"} ${label}`);
  if (!cond) fail++;
};

async function main() {
  const { construirEsqueletoReporte } = await import("../lib/fontana/reporte/reporteSesionSkeleton");
  const { parsearProsa, ensamblar } = await import("../lib/fontana/reporte/generarReporteSesion");
  const { jobEnCurso, REPORTE_JOB_STALE_MS } = await import("../lib/fontana/reporte/reporteJob");
  const { MOTIVO_TIMEOUT_REPORTE, MOTIVO_NIVEL_NO_CUBIERTO } = await import("../lib/fontana/tablaColumnas");

  // ---------- fixtures ----------
  const familiasVacias = () =>
    ({
      F1: { minimos: [], seleccionUsuario: [] },
      F2: { minimos: [], seleccionUsuario: [] },
      F3: { minimos: [], seleccionUsuario: [] },
      F4: { minimos: [], seleccionUsuario: [] },
      F5: { minimos: [], seleccionUsuario: [] },
    }) as FontanaSesion["indicadoresPorFamilia"];

  const sesionBase = (over: Partial<FontanaSesion>): FontanaSesion =>
    ({
      sesionId: "s1",
      uid: "u1",
      tareaPipIds: [],
      tipoProyecto: "electoral",
      territorio: { nivel: "estatal", pais: "México", estado: "Oaxaca", nombre: "Oaxaca" },
      indicadoresPorFamilia: familiasVacias(),
      fechaUltimoGuardado: new Date().toISOString(),
      versionSesion: 1,
      ...over,
    }) as FontanaSesion;

  const resumenItem = (id: string, over: Partial<FontanaCanvasItem> = {}): FontanaCanvasItem =>
    ({
      id: `cv-${id}`,
      tipo: "resumen",
      titulo: `Resumen ${id}`,
      familiaId: "F1",
      creadoEn: new Date().toISOString(),
      mensajeId: "m1",
      nivel: "estatal",
      filas: [{ indicadorId: id, nombre: `Indicador ${id}`, valor: "12.3", unidad: "%", fuenteEtiqueta: "INEGI" }],
      ...over,
    }) as FontanaCanvasItem;

  const indTabla = (
    id: string,
    celdas: FontanaContextoTerritorial["indicadores"][number]["celdas"]
  ): FontanaContextoTerritorial["indicadores"][number] => ({ id, nombre: `Indicador tabla ${id}`, celdas });

  // ===================================================================
  console.log("\n1. Opción C — esqueleto + ensamblado sin pérdida de tablas");
  {
    const fam = familiasVacias();
    fam.F1.minimos = ["F1-1"];
    const sesion = sesionBase({
      tareaPipIds: ["t1"],
      nombre: "Senaduría Oaxaca",
      indicadoresPorFamilia: fam,
      canvasItems: [resumenItem("F2-9", { familiaId: "F2" })],
    });
    const indicadoresTabla = [
      indTabla("F1-1", [
        { nivel: "nacional", valor: 6.1, unidad: "%", fuenteEtiqueta: "CONEVAL" },
        { nivel: "estatal", valor: 31.7, unidad: "%", fuenteEtiqueta: "CONEVAL" },
      ]),
      indTabla("F3-2", [{ nivel: "estatal", motivo: MOTIVO_TIMEOUT_REPORTE }]),
    ];

    const esq = construirEsqueletoReporte(sesion, "Senaduría Oaxaca 2024", indicadoresTabla);

    ok("hayContenido = true", esq.hayContenido);
    ok("origen = canal1", esq.origen === "canal1");
    ok(
      "cabecera: línea 1 proyecto, línea 2 Territorio, línea 3 Generado",
      esq.cabecera.startsWith("# Reporte de sesión — Senaduría Oaxaca 2024\n\n**Territorio:** Oaxaca\n\nGenerado el ")
    );
    ok("2 bloques (heredados + exploración)", esq.bloques.length === 2);
    ok(
      "bloque 1 = heredados",
      esq.bloques[0].titulo === "Indicadores del Programa de Investigación (heredados del proyecto)"
    );
    ok("F1-1 (en minimos) → bloque de heredados", esq.bloques[0].markdown.includes("31.7"));
    ok("F3-2 (no en minimos) NO en heredados", !esq.bloques[0].markdown.includes("31.7") ? false : !esq.bloques[0].markdown.includes(MOTIVO_TIMEOUT_REPORTE));
    ok("F3-2 (timeout, no heredado) → bloque de exploración", esq.bloques[1].markdown.includes(MOTIVO_TIMEOUT_REPORTE));
    ok("canvasItem F2-9 (no heredado) → bloque de exploración", esq.bloques[1].markdown.includes("Resumen F2-9"));
    ok("resumenProsa: una entrada '## ' por bloque", (esq.resumenProsa.match(/^## /gm)?.length ?? 0) === 2);
    ok("resumenProsa: sin tablas markdown", !/\n\|[-\s|]+\|/.test(esq.resumenProsa));
    ok("canvasItemsRef = [cv-F2-9]", JSON.stringify(esq.canvasItemsRef) === JSON.stringify(["cv-F2-9"]));

    const prosa = {
      lecturaEjecutiva: "Lectura ejecutiva de prueba con contexto estratégico.",
      parrafosPorSeccion: {
        [esq.bloques[0].titulo]: "Parrafo heredados marcador-A (Fuente: CONEVAL).",
        [esq.bloques[1].titulo]: "Parrafo exploracion marcador-B (Fuente: INEGI).",
      },
    };
    const md = ensamblar(esq, prosa);
    ok("ensamblado: cabecera al inicio", md.startsWith(esq.cabecera));
    ok("ensamblado: lecturaEjecutiva presente", md.includes("Lectura ejecutiva de prueba"));
    ok("ensamblado: párrafo de cada sección presente", md.includes("marcador-A") && md.includes("marcador-B"));
    ok(
      "ensamblado: markdown determinístico de CADA bloque conservado íntegro",
      esq.bloques.every((b) => md.includes(b.markdown))
    );
    ok("ensamblado: valor 31.7 de F1-1 intacto", md.includes("31.7"));
    ok("ensamblado: motivo de timeout de F3-2 intacto", md.includes(MOTIVO_TIMEOUT_REPORTE));
    ok("ensamblado: exactamente 2 títulos '## '", (md.match(/^## /gm)?.length ?? 0) === 2);

    const mdFallback = ensamblar(esq, null);
    ok("fallback (prosa null) === markdownEsqueleto", mdFallback === esq.markdownEsqueleto);
  }

  {
    const sesion = sesionBase({ nombre: "Exploración Oaxaca", canvasItems: [resumenItem("F1-3")] });
    const esq = construirEsqueletoReporte(sesion, undefined, []);
    ok("suelta: origen = suelta", esq.origen === "suelta");
    ok(
      "suelta: 1 bloque 'Hallazgos de la sesión'",
      esq.bloques.length === 1 && esq.bloques[0].titulo === "Hallazgos de la sesión"
    );
    ok("suelta: cabecera usa sesion.nombre", esq.cabecera.startsWith("# Reporte de sesión — Exploración Oaxaca\n\n"));
  }

  {
    const esq = construirEsqueletoReporte(sesionBase({ canvasItems: [] }), undefined, []);
    ok("sin contenido: hayContenido = false", !esq.hayContenido);
    ok("sin contenido: bloques vacío", esq.bloques.length === 0);
    ok("sin contenido: markdownEsqueleto empieza por la cabecera", esq.markdownEsqueleto.startsWith(esq.cabecera));
  }

  // ===================================================================
  console.log("\n2. parsearProsa — tolerancia y validación");
  {
    const bueno = '{"lecturaEjecutiva":"x","parrafosPorSeccion":{"A":"y"}}';
    ok("JSON plano válido → objeto", !!parsearProsa(bueno));
    ok("con fence ```json → objeto", !!parsearProsa("```json\n" + bueno + "\n```"));
    ok("con fence ``` simple → objeto", !!parsearProsa("```\n" + bueno + "\n```"));
    ok("texto no-JSON → null", parsearProsa("Aquí está el reporte:") === null);
    ok("falta parrafosPorSeccion → null", parsearProsa('{"lecturaEjecutiva":"x"}') === null);
    ok("parrafosPorSeccion no-objeto → null", parsearProsa('{"lecturaEjecutiva":"x","parrafosPorSeccion":"z"}') === null);
  }

  // ===================================================================
  console.log("\n3. jobEnCurso — base de la idempotencia (dos clics → un job)");
  {
    const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
    ok("null → false", jobEnCurso(null) === false);
    ok("pending → true (un 2º POST reusa)", jobEnCurso({ jobId: "j", status: "pending", startedAt: iso(1000) }) === true);
    ok("running fresco → true", jobEnCurso({ jobId: "j", status: "running", startedAt: iso(5000) }) === true);
    ok(
      "running colgado (> STALE) → false (se relanza)",
      jobEnCurso({ jobId: "j", status: "running", startedAt: iso(REPORTE_JOB_STALE_MS + 1000) }) === false
    );
    ok(
      "completed → false",
      jobEnCurso({ jobId: "j", status: "completed", startedAt: iso(1000), completedAt: iso(0) }) === false
    );
    ok("failed → false", jobEnCurso({ jobId: "j", status: "failed", startedAt: iso(1000), error: "x" }) === false);
    console.log("     (doc de job con id fijo 'job' → crearReporteJob().set() escribe SIEMPRE");
    console.log("      el mismo documento; imposible tener 2 jobs por sesión)");
  }

  // ===================================================================
  console.log("\n4. MOTIVO_TIMEOUT_REPORTE — honesto y específico de timeout");
  {
    ok("menciona 'a tiempo' / 'límite'", /a tiempo|l[íi]mite/i.test(MOTIVO_TIMEOUT_REPORTE));
    ok("invita a reintentar", /vuelve a generar|reintenta/i.test(MOTIVO_TIMEOUT_REPORTE));
    ok(
      "NO se confunde con 'sin dato para este territorio'",
      !/no (hay|existe|se publica|tiene) (dato|información)/i.test(MOTIVO_TIMEOUT_REPORTE) &&
        (MOTIVO_TIMEOUT_REPORTE as string) !== (MOTIVO_NIVEL_NO_CUBIERTO as string)
    );
    console.log(`     motivo = "${MOTIVO_TIMEOUT_REPORTE}"`);
  }

  // ===================================================================
  console.log("\n5. Encuadre del Reporte de Sesión por tipo de proyecto (26-09-11)");
  {
    const { construirSystemProsa } = await import("../lib/fontana/reporte/generarReporteSesion");
    const { ENCUADRE_POR_TIPO, ENCUADRE_INSTRUCCION } = await import("../lib/fontana/agente/systemPrompt");
    const TIPOS = ["electoral", "gubernamental", "legislativo", "ciudadano"] as const;

    for (const tipo of TIPOS) {
      const prompt = construirSystemProsa(tipo);
      ok(`${tipo}: SYSTEM_PROSA usa su propio encuadre`, prompt.includes(ENCUADRE_POR_TIPO[tipo]));
      ok(`${tipo}: SYSTEM_PROSA incluye la instrucción "punto de partida, no restricción"`, prompt.includes(ENCUADRE_INSTRUCCION));
      ok(`${tipo}: SYSTEM_PROSA ya NO dice "un proyecto político" genérico`, !prompt.includes("un proyecto político"));
      for (const otro of TIPOS) {
        if (otro === tipo) continue;
        ok(`${tipo}: SYSTEM_PROSA NO contiene el encuadre de "${otro}"`, !prompt.includes(ENCUADRE_POR_TIPO[otro]));
      }
    }

    // Verificación EN VIVO — un tipo no electoral (gubernamental) genera
    // prosa real con Claude y se confirma que la lectura refleja el encuadre.
    const { anthropic, CLAUDE_MODEL } = await import("../lib/ai/claude");
    const resumenSintetico = [
      "Territorio: Oaxaca de Juárez.",
      "## Hallazgos de la sesión",
      "- Población indígena: Municipal 12.4%, Estatal 65.7%, Nacional 19.4% (Fuente: INEGI, Censo 2020 vía ECEG)",
    ].join("\n");
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: construirSystemProsa("gubernamental"),
      messages: [{ role: "user", content: resumenSintetico }],
    });
    const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    console.log("\n     --- prosa real generada (tipo gubernamental) ---");
    console.log(
      texto
        .split("\n")
        .map((l) => "     " + l)
        .join("\n")
    );
    const textoLower = texto.toLowerCase();
    ok('prosa real (gubernamental): NO dice "proyecto político"', !textoLower.includes("proyecto político"));
    ok(
      "prosa real (gubernamental): usa vocabulario del encuadre esperado (servicio/presupuest/política pública)",
      /servicio|presupuest|política pública|públic/i.test(texto)
    );
  }

  console.log(fail === 0 ? "\n✅ TODO OK\n" : `\n❌ ${fail} fallo(s)\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
