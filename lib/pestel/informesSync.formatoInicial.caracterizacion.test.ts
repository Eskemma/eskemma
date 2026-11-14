// H80 — caracterización de la regla «qué informe se muestra al cargar la página de informes (sin preferencia)».
// ORÁCULO: copia de la regla que la página tenía en línea desde el commit 9484a0f (26-10-03), app/centinela/pestel/[projectId]/informes/page.tsx,
// efecto de carga inicial (l.338-346 en ese commit: `const formatos = REPORT_FORMATS.filter(…)` y `masReciente = formatos.reduce(…)`): el formato con MAYOR `generadoEn` entre los que
// tienen texto vigente; en empate gana el primero en el orden de REPORT_FORMATS (el reduce usa `>=`). A y B1 (d5f092a, 02b739a) no la tocaron.
// Estas pruebas fijan que `elegirFormatoInicial(vigentes)` SIN preferencia da exactamente lo mismo que la expresión original.

import { describe, expect, it } from "vitest";
import { elegirFormatoInicial, REPORT_FORMATS, FORMATO_POR_REPORT_FORMAT, textoVigente } from "./informesSync";
import type { ReportFormat } from "./reportPrompts";
import type { InformeGenerado } from "@/types/pestel.types";

type Vigentes = Partial<Record<ReportFormat, InformeGenerado>>;

// ── ORÁCULO (9484a0f, 26-10-03) ──────────────────────────────────────────────────────────────
function oraculo(vigentes: Vigentes): ReportFormat | null {
  const textos: Partial<Record<ReportFormat, string>> = {};
  for (const rf of REPORT_FORMATS) {
    const inf = vigentes[rf];
    if (!inf) continue;
    textos[rf] = textoVigente(inf);
  }
  const formatos = REPORT_FORMATS.filter((rf) => textos[rf]);
  if (formatos.length > 0) {
    // el formato más recientemente generado
    return formatos.reduce((a, b) => (Date.parse(vigentes[a]!.generadoEn) >= Date.parse(vigentes[b]!.generadoEn) ? a : b));
  }
  return null;
}
// ─────────────────────────────────────────────────────────────────────────────────────────────

const inf = (rf: ReportFormat, generadoEn: string, extra: Partial<InformeGenerado> = {}): InformeGenerado => ({
  id: `i-${rf}`,
  formato: FORMATO_POR_REPORT_FORMAT[rf],
  contenidoTexto: `texto ${rf}`,
  datosEstructurados: { scorecard: [], mapaPESTEL: {} },
  generadoEn,
  ...extra,
});
const dia = (n: number) => `2026-11-${String(10 + n).padStart(2, "0")}T10:00:00.000Z`;

/** Todos los subconjuntos de los 5 formatos (32, incluido el vacío). */
const subconjuntos = (): ReportFormat[][] =>
  Array.from({ length: 1 << REPORT_FORMATS.length }, (_, mask) => REPORT_FORMATS.filter((_, i) => mask & (1 << i)));

describe("elegirFormatoInicial SIN preferencia = la regla original (oráculo de 9484a0f)", () => {
  it("32 subconjuntos × 9 patrones de fechas (iguales, ascendentes, descendentes y cada formato como único más reciente)", () => {
    const patrones: ((i: number, rf: ReportFormat) => string)[] = [
      () => dia(1), // todas iguales (empate total)
      (i) => dia(i), // ascendente por orden de REPORT_FORMATS
      (i) => dia(10 - i), // descendente
      ...REPORT_FORMATS.map((objetivo) => (_: number, rf: ReportFormat) => (rf === objetivo ? dia(9) : dia(1))), // uno solo el más reciente
    ];
    let comparados = 0;
    for (const sub of subconjuntos()) {
      for (const patron of patrones) {
        const vigentes: Vigentes = {};
        sub.forEach((rf, i) => (vigentes[rf] = inf(rf, patron(i, rf))));
        expect(elegirFormatoInicial(vigentes), `${sub.join(",")}`).toBe(oraculo(vigentes));
        comparados++;
      }
    }
    expect(comparados).toBe(32 * 8); // 3 + 5 patrones
  });

  it("empate en el más reciente: gana el primero en el orden de REPORT_FORMATS (dos y tres empatados)", () => {
    const dos: Vigentes = { foda: inf("foda", dia(5)), technical: inf("technical", dia(5)), executive: inf("executive", dia(1)) };
    expect(elegirFormatoInicial(dos)).toBe(oraculo(dos));
    expect(elegirFormatoInicial(dos)).toBe("technical");
    const tres: Vigentes = { scenarios: inf("scenarios", dia(7)), foda: inf("foda", dia(7)), insights_por_tipo: inf("insights_por_tipo", dia(7)) };
    expect(elegirFormatoInicial(tres)).toBe(oraculo(tres));
    expect(elegirFormatoInicial(tres)).toBe("foda");
  });

  it("un informe sin texto vigente no cuenta (texto vacío, o edición vacía sobre la generación)", () => {
    const v: Vigentes = {
      technical: inf("technical", dia(9), { contenidoTexto: "" }), // vacío
      foda: inf("foda", dia(8), { contenidoEditado: "" }), // edición vacía: textoVigente = ""
      executive: inf("executive", dia(1)),
    };
    expect(elegirFormatoInicial(v)).toBe(oraculo(v));
    expect(elegirFormatoInicial(v)).toBe("executive");
  });

  it("editar un informe NO cambia cuál es el más reciente (editadoEn no entra)", () => {
    const v: Vigentes = {
      technical: inf("technical", dia(1), { contenidoEditado: "editado", editadoEn: dia(20) }),
      foda: inf("foda", dia(2)),
    };
    expect(elegirFormatoInicial(v)).toBe(oraculo(v));
    expect(elegirFormatoInicial(v)).toBe("foda");
  });

  it("fecha ilegible: mismo resultado que la expresión original (el reduce con NaN)", () => {
    for (const orden of [["technical", "foda"], ["foda", "technical"]] as ReportFormat[][]) {
      const v: Vigentes = {};
      v[orden[0]] = inf(orden[0], "no-es-fecha");
      v[orden[1]] = inf(orden[1], dia(3));
      expect(elegirFormatoInicial(v)).toBe(oraculo(v));
    }
  });

  it("sin informes: null (como no seleccionar nada)", () => {
    expect(elegirFormatoInicial({})).toBeNull();
    expect(oraculo({})).toBeNull();
  });
});
