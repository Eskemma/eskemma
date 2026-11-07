// T7 C3: la nota de aprobación del analista — qué es, cuándo existe, cómo se compara y cómo se dice en pantalla.
import { describe, expect, it } from "vitest";
import {
  anexarNotaALinea, fraseNotaParaTrazabilidad, importacionConNota, leerNotaGuardada, notaDeAprobacion, notaEquivalente,
  notaParaHuella, notaSinReflejarEnF2, textoNotaAprobacion, TEXTO_NOTA_NO_DISPONIBLE, TEXTO_NOTA_SIN_REFLEJAR_F2,
} from "./notaAprobacion";
import { huellaDeOrigen } from "./huellaOrigen";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "./__fixtures__/analisisEjemplo";

const APROBADO_39 = { status: "APPROVED", globalConfidence: 39, aprobacionJustificacion: "  Se aprueba con reservas documentadas.  ", approvedAt: "2026-10-20T15:30:00.000Z" };

describe("notaDeAprobacion — la «nota actual» de un análisis", () => {
  it("APPROVED con confianza baja y justificación: confianza, justificación recortada y fecha ISO", () => {
    expect(notaDeAprobacion(APROBADO_39)).toEqual({ confianza: 39, justificacion: "Se aprueba con reservas documentadas.", aprobadoEn: "2026-10-20T15:30:00.000Z" });
  });
  it("el caso real aprobado con 39 ANTES de T6-9a (sin justificación guardada): hay nota, sin justificación (nunca una cadena vacía)", () => {
    const n = notaDeAprobacion({ status: "APPROVED", globalConfidence: 39 });
    expect(n).toEqual({ confianza: 39 });
    expect("justificacion" in n!).toBe(false);
    expect(notaDeAprobacion({ ...APROBADO_39, aprobacionJustificacion: "   " })).not.toHaveProperty("justificacion");
  });
  it.each([
    ["confianza suficiente", { ...APROBADO_39, globalConfidence: 50 }],
    ["sin confianza", { ...APROBADO_39, globalConfidence: undefined }],
    ["sin aprobar (REVIEWED)", { ...APROBADO_39, status: "REVIEWED" }],
    ["un ajuste retiró la aprobación", { status: "REVIEWED", globalConfidence: 39, aprobacionAnterior: { justificacion: "x".repeat(30) } }],
    ["sin análisis", null],
  ])("no hay nota: %s", (_n, a) => {
    expect(notaDeAprobacion(a as never)).toBeNull();
  });
  it("una fecha ilegible solo omite la fecha, la nota se conserva", () => {
    expect(notaDeAprobacion({ ...APROBADO_39, approvedAt: "no es fecha" })).toEqual({ confianza: 39, justificacion: "Se aprueba con reservas documentadas." });
  });
});

describe("leerNotaGuardada / notaEquivalente / notaParaHuella", () => {
  it("lee sin confiar en la forma", () => {
    expect(leerNotaGuardada({ confianza: 39, justificacion: " x ", aprobadoEn: "2026-10-20T00:00:00.000Z" })).toEqual({ confianza: 39, justificacion: "x", aprobadoEn: "2026-10-20T00:00:00.000Z" });
    for (const malo of [null, undefined, "x", 3, {}, { confianza: "39" }, { confianza: NaN }]) expect(leerNotaGuardada(malo)).toBeNull();
  });
  it("equivalente: misma confianza y justificación recortada; la fecha no cuenta; ausente = ausente", () => {
    expect(notaEquivalente(null, null)).toBe(true);
    expect(notaEquivalente({ confianza: 39, justificacion: "x" }, { confianza: 39, justificacion: " x ", aprobadoEn: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(notaEquivalente({ confianza: 39, justificacion: "x" }, { confianza: 38, justificacion: "x" })).toBe(false);
    expect(notaEquivalente({ confianza: 39, justificacion: "x" }, { confianza: 39 })).toBe(false);
    expect(notaEquivalente({ confianza: 39 }, null)).toBe(false);
  });
  it("lo que entra en la huella: sin fecha, justificación recortada", () => {
    expect(notaParaHuella({ confianza: 39, justificacion: " x ", aprobadoEn: "2026-01-01T00:00:00.000Z" })).toEqual({ confianza: 39, justificacion: "x" });
    expect(notaParaHuella(null)).toBeNull();
  });
});

describe("el contrato de escritores: approve y adjust ahora alteran la huella v2, y NUNCA la v1", () => {
  const h = (version: number, a: object | null) => huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { version, nota: a ? notaDeAprobacion(a) : null }).h;
  it("aprobar con confianza baja (approve) mueve la huella v2; en v1 no cambia nada", () => {
    expect(h(2, APROBADO_39)).not.toBe(h(2, null));
    expect(h(1, APROBADO_39)).toBe(h(1, null));
  });
  it("volver a aprobar con OTRA justificación mueve la v2; con la misma, no; retirar la aprobación (adjust) la mueve", () => {
    expect(h(2, { ...APROBADO_39, aprobacionJustificacion: "Otra justificación distinta." })).not.toBe(h(2, APROBADO_39));
    expect(h(2, { ...APROBADO_39, approvedAt: "2027-01-01T00:00:00.000Z" })).toBe(h(2, APROBADO_39));
    expect(h(2, { ...APROBADO_39, status: "REVIEWED" })).not.toBe(h(2, APROBADO_39));
  });
});

describe("importacionConNota y el texto que ve F2", () => {
  it("solo las importaciones con huella v2 guardan la nota; v1 o sin huella, nunca", () => {
    expect(importacionConNota({ v: 2 })).toBe(true);
    for (const x of [{ v: 1 }, {}, null, undefined, { v: 3 }]) expect(importacionConNota(x as never)).toBe(false);
  });
  it("importación previa (v1 o sin huella): «no disponible», sin sugerir cómo obtenerla", () => {
    for (const hf of [{ v: 1 }, undefined]) {
      const t = textoNotaAprobacion(hf, { confianza: 39 });
      expect(t).toEqual({ tipo: "no_disponible", texto: TEXTO_NOTA_NO_DISPONIBLE });
    }
    expect(TEXTO_NOTA_NO_DISPONIBLE).toBe("No disponible para esta importación (se hizo antes de que F2 guardara la nota de aprobación).");
    expect(TEXTO_NOTA_NO_DISPONIBLE).not.toMatch(/Regresar|reimport|vuelve|actualiza|Centinela|Desvincular|usa/i);
  });
  it("v2 con confianza baja SIN justificación: dice que no hay justificación registrada (no inventa ni insinúa una nota)", () => {
    const t = textoNotaAprobacion({ v: 2 }, { confianza: 39 })!;
    expect(t.tipo).toBe("sin_justificacion");
    expect(t.texto).toBe("El análisis se aprobó con una confianza global de 39 %, por debajo del 50 % recomendado; no hay justificación registrada.");
  });
  it("v2 con justificación: la muestra atribuida al analista", () => {
    const t = textoNotaAprobacion({ v: 2 }, { confianza: 39, justificacion: "Se aprueba con reservas." })!;
    expect(t.tipo).toBe("con_justificacion");
    expect(t.texto).toBe("Según el analista, que aprobó el análisis con una confianza global de 39 %: «Se aprueba con reservas.»");
  });
  it("v2 sin nota (aprobado con confianza suficiente o sin aprobar): no hay nada que decir", () => {
    expect(textoNotaAprobacion({ v: 2 }, null)).toBeNull();
  });
});

describe("línea de trazabilidad y descargas", () => {
  const T22 = { kind: "T22", sourceAnalysisId: "a1" };
  it("solo un análisis de Centinela importado (T22 con análisis): un M1 express no recibe ni «no disponible»", () => {
    expect(fraseNotaParaTrazabilidad({ kind: "express" })).toBeNull();
    expect(fraseNotaParaTrazabilidad({ kind: "T22" })).toBeNull();
    expect(fraseNotaParaTrazabilidad(undefined)).toBeNull();
  });
  it("importación previa → «Nota de aprobación del analista: no disponible…» (minúscula tras los dos puntos)", () => {
    expect(fraseNotaParaTrazabilidad({ ...T22, huellaFuente: { v: 1 } })).toBe(
      "Nota de aprobación del analista: no disponible para esta importación (se hizo antes de que F2 guardara la nota de aprobación)."
    );
    expect(fraseNotaParaTrazabilidad(T22)).toMatch(/^Nota de aprobación del analista: no disponible/);
  });
  it("v2 con nota: la nota; v2 sin nota: nada; la línea base se conserva", () => {
    expect(fraseNotaParaTrazabilidad({ ...T22, huellaFuente: { v: 2 }, aprobacionOrigen: { confianza: 39 } })).toContain("no hay justificación registrada");
    expect(fraseNotaParaTrazabilidad({ ...T22, huellaFuente: { v: 2 } })).toBeNull();
    expect(anexarNotaALinea("Análisis aprobado sin ajustes el 1 de octubre de 2026.", { ...T22, huellaFuente: { v: 2 } })).toBe("Análisis aprobado sin ajustes el 1 de octubre de 2026.");
    expect(anexarNotaALinea(null, { ...T22, huellaFuente: { v: 1 } })).toBeNull();
    expect(anexarNotaALinea("Línea.", { ...T22, huellaFuente: { v: 2 }, aprobacionOrigen: { confianza: 39, justificacion: "Con reservas." } })).toBe(
      "Línea. Según el analista, que aprobó el análisis con una confianza global de 39 %: «Con reservas.»"
    );
  });
});

describe("notaSinReflejarEnF2 — el aviso de Centinela solo si es accionable", () => {
  const actual = { confianza: 39, justificacion: "Con reservas." };
  const imp = (extra: object = {}) => ({ v: 2, nota: null, sourceAnalysisId: "a1", ...extra }) as never;
  it("vínculo v2, este análisis, nota actual distinta de la importada → avisa", () => {
    expect(notaSinReflejarEnF2("a1", actual, imp())).toBe(true);
    expect(notaSinReflejarEnF2("a1", actual, imp({ nota: { confianza: 39, justificacion: "Otra." } }))).toBe(true);
  });
  it("NO avisa con vínculo v1 ni sin huella (inaccionable: nunca adquieren la nota)", () => {
    expect(notaSinReflejarEnF2("a1", actual, imp({ v: 1 }))).toBe(false);
    expect(notaSinReflejarEnF2("a1", actual, imp({ v: null }))).toBe(false);
  });
  it("NO avisa si F2 importó OTRO análisis, si la nota es equivalente, si no hay nota actual o no se pudo leer", () => {
    expect(notaSinReflejarEnF2("a1", actual, imp({ sourceAnalysisId: "a2" }))).toBe(false);
    expect(notaSinReflejarEnF2("a1", actual, imp({ nota: { ...actual, aprobadoEn: "2026-01-01T00:00:00.000Z" } }))).toBe(false);
    expect(notaSinReflejarEnF2("a1", null, imp())).toBe(false);
    expect(notaSinReflejarEnF2("a1", actual, null)).toBe(false);
    expect(notaSinReflejarEnF2(undefined, actual, imp())).toBe(false);
  });
  it("el texto del aviso nombra el botón que existe y dónde está", () => {
    expect(TEXTO_NOTA_SIN_REFLEJAR_F2).toContain("«Regresar a Moddulo F2 con resultados»");
    expect(TEXTO_NOTA_SIN_REFLEJAR_F2).toContain("Análisis o Monitoreo");
  });
});
