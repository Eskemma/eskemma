// Commit 1 (estados de trabajo de F2): la zona central usa el cierre REAL de la fase, el bloqueo de acciones mientras el
// M1 se edita o se generan los motores, el texto del indicador de proceso y la cautela de recarga.
import { describe, expect, it } from "vitest";
import {
  indicadorProcesoMotores, motivoBloqueoAccionesF2, TEXTO_CAUTELA_RECARGA, TEXTO_GENERANDO, textoBloqueoAccionesF2,
  zonaCentroMotores,
} from "./pantallaM1";

const base = {
  f2Cerrada: false, hayDvs: false, hayBorrador: false, generando: false, hayErrorGeneracion: false, showReporte: false,
  reporteAnterior: false, motoresGeneradosDelM1: false, hayMensajeArea: false, avisoSinGenerar: false,
};

describe("zonaCentroMotores — tabla del paso «estados de trabajo»", () => {
  it.each([
    // [descripción, entrada, zona esperada]
    ["análisis anterior finalizado + aprobado + GENERANDO (el defecto: antes «completo»)", { hayDvs: true, generando: true }, "motores"],
    ["análisis anterior finalizado + aprobado + borrador nuevo sin finalizar (el defecto)", { hayDvs: true, hayBorrador: true, motoresGeneradosDelM1: true }, "motores"],
    ["análisis anterior finalizado + error de generación", { hayDvs: true, hayErrorGeneracion: true }, "motores"],
    ["análisis finalizado de ESTE M1, nada pendiente", { hayDvs: true, motoresGeneradosDelM1: true }, "completo"],
    ["fase cerrada con análisis finalizado", { f2Cerrada: true, hayDvs: true }, "completo"],
    ["fase cerrada aunque haya un borrador local", { f2Cerrada: true, hayDvs: true, hayBorrador: true }, "completo"],
    ["recarga a mitad de generación: finalizado anterior, sin borrador, motores sin generar", { hayDvs: true, avisoSinGenerar: true }, "sin_generar"],
    ["recarga tras generar: finalizado anterior + borrador guardado", { hayDvs: true, hayBorrador: true, motoresGeneradosDelM1: true }, "motores"],
    ["sin análisis finalizado, aprobado y generando", { generando: true }, "motores"],
    ["sin análisis finalizado ni borrador, sin generar", { avisoSinGenerar: true }, "sin_generar"],
    ["M1 reabierto con análisis anterior: mensaje", { hayDvs: true, reporteAnterior: true, hayMensajeArea: true }, "mensaje"],
    ["Reporte F2 abierto sobre un finalizado de este M1", { hayDvs: true, showReporte: true, motoresGeneradosDelM1: true }, "motores"],
  ] as const)("%s → %s", (_d, entrada, esperada) => {
    expect(zonaCentroMotores({ ...base, ...entrada })).toBe(esperada);
  });

  it("el defecto anterior: tratar «hay un análisis finalizado en pantalla» como fase cerrada daba «completo» mientras se generaba", () => {
    const modoCompletedAntes = true; // mode === "completed" también valía con la fase ABIERTA
    expect(zonaCentroMotores({ ...base, f2Cerrada: modoCompletedAntes, hayDvs: true, generando: true })).toBe("completo");
    expect(zonaCentroMotores({ ...base, f2Cerrada: false, hayDvs: true, generando: true })).toBe("motores");
  });
});

describe("motivoBloqueoAccionesF2", () => {
  it.each([
    ["borrador", false, "m1_en_edicion"],
    ["reabierto", false, "m1_en_edicion"],
    ["reabierto", true, "m1_en_edicion"],
    ["aprobado", true, "generando"],
    ["aprobado", false, null],
    ["anterior", false, null],
    ["sin_m1", false, null],
    [null, false, null],
    [null, true, "generando"],
  ] as const)("estado %s, generando %s → %s", (estado, generando, esperado) => {
    expect(motivoBloqueoAccionesF2({ estado, generando })).toBe(esperado);
  });
  it("con la fase cerrada nada se bloquea (el reporte se puede leer)", () => {
    expect(motivoBloqueoAccionesF2({ estado: "reabierto", generando: true, f2Cerrada: true })).toBeNull();
    expect(motivoBloqueoAccionesF2({ estado: "aprobado", generando: true, f2Cerrada: true })).toBeNull();
  });
  it("los textos: invitan a aprobar solo si el botón existe; el de generación no invita a nada", () => {
    expect(textoBloqueoAccionesF2("m1_en_edicion", true)).toBe("Aprueba el análisis PESTEL para habilitar esta acción.");
    expect(textoBloqueoAccionesF2("m1_en_edicion", false)).toBe("El análisis PESTEL no está aprobado.");
    expect(textoBloqueoAccionesF2("generando", true)).toBe("Se están generando los motores M2–M5. Espera a que termine.");
    for (const m of ["m1_en_edicion", "generando"] as const) {
      for (const p of [true, false]) expect(textoBloqueoAccionesF2(m, p)).not.toMatch(/Claude|m1_|generando$/);
    }
  });
});

describe("indicadorProcesoMotores — la frase «última versión válida» solo si es verdadera", () => {
  it("sin generar: nada", () => {
    expect(indicadorProcesoMotores({ generando: false, zona: "motores", hayBorrador: true })).toBeNull();
  });
  it("zona de motores con borrador previo a la vista: «Actualizando…» con la frase de la última versión válida", () => {
    expect(indicadorProcesoMotores({ generando: true, zona: "motores", hayBorrador: true })).toBe(
      "Actualizando análisis… lo que ves abajo es la última versión válida."
    );
  });
  it("zona de motores sin borrador: ya muestra su propio esqueleto de carga → nada que añadir", () => {
    expect(indicadorProcesoMotores({ generando: true, zona: "motores", hayBorrador: false })).toBeNull();
  });
  it.each(["completo", "mensaje", "sin_generar"] as const)("zona %s: solo «Generando…», sin la frase de la versión válida", (zona) => {
    const t = indicadorProcesoMotores({ generando: true, zona, hayBorrador: false });
    expect(t).toBe(TEXTO_GENERANDO);
    expect(t).not.toMatch(/versión válida/);
    expect(t).not.toMatch(/Claude/);
  });
});

describe("cautela de recarga", () => {
  it("afirma solo una posibilidad", () => {
    expect(TEXTO_CAUTELA_RECARGA).toBe("Si acabas de aprobar, la generación puede seguir en curso: espera unos minutos y recarga antes de reintentar.");
    expect(TEXTO_CAUTELA_RECARGA).toMatch(/puede seguir/);
    expect(TEXTO_CAUTELA_RECARGA).not.toMatch(/Claude/);
  });
});
