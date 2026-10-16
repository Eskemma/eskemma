// textosModalM1: the M1 modals are built from the same lines as the server, show only what applies
// to the real state, and never use internal words. Pure functions (API nueva).

import { describe, expect, it } from "vitest";
import { MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES, estadoImpactoDesdePantalla, textoModalM1, type DatosPantallaM1 } from "./textosModalM1";
import { lineasImpactoM1 } from "./impactoM1";

const datos = (o: Partial<DatosPantallaM1> = {}): DatosPantallaM1 => ({
  estado: "borrador", aprobacionValida: false, dimensionesEditadas: [], totalDimensiones: 6,
  motoresAprobados: [], hayBorrador: false, hayDvs: false, ...o,
});
const completo = estadoImpactoDesdePantalla(datos({
  estado: "aprobado", aprobacionValida: true, dimensionesEditadas: ["P", "S"], motoresAprobados: ["M2", "M3"], hayBorrador: true, hayDvs: true,
}));
const limpio = estadoImpactoDesdePantalla(datos());
const sinM1 = estadoImpactoDesdePantalla(datos({ estado: "sin_m1" }));

describe("estadoImpactoDesdePantalla", () => {
  it("traduce lo que la pantalla ya tiene; sin M1 no hay payload; sin huellas (solo las usa el servidor)", () => {
    expect(completo).toMatchObject({ hayPayload: true, aprobada: true, huellaPayload: null, huellaAprobacion: null, huellaGeneracion: null });
    expect(sinM1.hayPayload).toBe(false);
    expect(estadoImpactoDesdePantalla(datos({ estado: "sin_m1_con_restos", hayBorrador: true })).hayPayload).toBe(false);
  });
});

describe("«Nuevo análisis»", () => {
  it("con todo el estado: ediciones (N de 6 con nombres), aprobación, motores y aprobaciones, Reporte F2 y cierre", () => {
    const t = textoModalM1("nuevo_analisis", completo);
    expect(t.titulo).toBe("¿Generar un análisis nuevo?");
    expect(t.intro).toEqual(["Se generará un análisis PESTEL desde cero y reemplazará al actual."]);
    expect(t.lineas).toEqual([
      "Se perderán tus ediciones en 2 de 6 categorías (Político, Social).",
      "Se perderá la aprobación del análisis.",
      "Se descartarán el borrador de motores y las aprobaciones de M2, M3.",
      "El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.",
    ]);
    expect(t.cierre).toBe("Si la generación falla, tu análisis actual se conserva.");
    expect(t.confirmar).toBe("Generar análisis nuevo");
  });
  it("un M1 recién generado, sin ediciones, aprobación ni motores: sin líneas de pérdida (solo el cierre)", () => {
    const t = textoModalM1("nuevo_analisis", limpio);
    expect(t.lineas).toEqual([]);
    expect(t.cierre).toBe("Si la generación falla, tu análisis actual se conserva.");
  });
  it("proyecto sin M1: ni «reemplazará al actual» ni cierre sobre conservarlo", () => {
    const t = textoModalM1("nuevo_analisis", sinM1);
    expect(t.intro[0]).not.toContain("reemplazará");
    expect(t.cierre).toBeNull();
    expect(t.lineas).toEqual([]);
  });
  it("sin M1 pero con restos (resto de un desvincular): lista el borrador y las aprobaciones, sin hablar de conservar", () => {
    const t = textoModalM1("nuevo_analisis", estadoImpactoDesdePantalla(datos({ estado: "sin_m1_con_restos", hayBorrador: true, motoresAprobados: ["M2"] })));
    expect(t.lineas).toEqual(["Se descartarán el borrador de motores y las aprobaciones de M2."]);
    expect(t.cierre).toBeNull();
  });
  it("solo aparece cada línea cuando aplica (solo borrador; solo aprobación)", () => {
    expect(textoModalM1("nuevo_analisis", estadoImpactoDesdePantalla(datos({ hayBorrador: true }))).lineas).toEqual(["Se descartará el borrador de motores."]);
    expect(textoModalM1("nuevo_analisis", estadoImpactoDesdePantalla(datos({ estado: "aprobado", aprobacionValida: true }))).lineas).toEqual(["Se perderá la aprobación del análisis."]);
  });
});

describe("«Editar narrativas» (reabrir)", () => {
  it("con motores: pausa, qué se descarta solo si el contenido cambia, y el Reporte F2", () => {
    const t = textoModalM1("reabrir", completo);
    expect(t.titulo).toBe("¿Editar las narrativas del análisis?");
    expect(t.intro).toEqual(["M1 quedará abierto para edición."]);
    expect(t.lineas).toEqual([
      "Se perderá la aprobación del análisis; podrás aprobarlo de nuevo.",
      "M2–M5 quedarán en pausa mientras esté abierto.",
      "Si al aprobar de nuevo el contenido es distinto, se descartarán el borrador de motores y las aprobaciones de M2, M3 y se regenerarán; si es idéntico, se conservan.",
      "El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.",
    ]);
    expect(t.confirmar).toBe("Editar narrativas");
  });
  it("aprobado sin motores: no habla de pausa ni de conservar motores que no existen", () => {
    const t = textoModalM1("reabrir", estadoImpactoDesdePantalla(datos({ estado: "aprobado", aprobacionValida: true })));
    expect(t.lineas).toEqual(["Se perderá la aprobación del análisis; podrás aprobarlo de nuevo."]);
  });
  it("NO lista ediciones: reabrir no las pierde", () => {
    expect(textoModalM1("reabrir", completo).lineas.join(" ")).not.toContain("ediciones");
  });
});

describe("«Vincular con análisis independiente»", () => {
  it("nombra el análisis, mismas líneas que «Nuevo análisis» y cierre de la importación", () => {
    const t = textoModalM1("vincular", completo, { nombre: "Campaña Zapopan" });
    expect(t.intro).toEqual(["Se importará «Campaña Zapopan» y reemplazará al actual."]);
    expect(t.lineas).toEqual(textoModalM1("nuevo_analisis", completo).lineas);
    expect(t.cierre).toBe("Si la importación falla, tu análisis actual se conserva.");
  });
  it("sin nombre no deja «undefined»", () => {
    expect(textoModalM1("vincular", limpio).intro.join(" ")).not.toMatch(/undefined|«»/);
  });
});

describe("«Desvincular» (el borrador y las aprobaciones se descartan)", () => {
  const centinela = estadoImpactoDesdePantalla(datos({ estado: "aprobado", aprobacionValida: true, motoresAprobados: ["M2", "M3"], hayBorrador: true, hayDvs: true, dimensionesEditadas: [] }));
  it("línea condicional de motores, aprobación y Reporte F2; sin línea de ediciones", () => {
    const t = textoModalM1("desvincular", centinela);
    expect(t.titulo).toBe("¿Desvincular del análisis de Centinela PESTEL?");
    expect(t.lineas).toEqual([
      "Se perderá la aprobación del análisis.",
      "Se descartarán el borrador de motores y las aprobaciones de M2, M3.",
      "El Reporte F2 finalizado no cambia hasta que lo vuelvas a finalizar.",
    ]);
    expect(t.lineas.join(" ")).not.toContain("ediciones");
    expect(t.confirmar).toBe("Desvincular");
  });
  it("aunque el estado traiga dimensiones editadas, desvincular no las lista (el M1 de Centinela no tiene)", () => {
    expect(textoModalM1("desvincular", completo).lineas.join(" ")).not.toContain("ediciones");
  });
  it("un M1 de Centinela sin aprobar, sin motores: sin líneas", () => {
    expect(textoModalM1("desvincular", limpio).lineas).toEqual([]);
  });
});

describe("líneas del servidor y palabras internas", () => {
  it("las líneas del 409 del servidor reemplazan a las locales", () => {
    const t = textoModalM1("reabrir", completo, { lineasServidor: ["Línea del servidor."] });
    expect(t.lineas).toEqual(["Línea del servidor."]);
  });
  it("las líneas locales son EXACTAMENTE las que arma impactoM1 (misma fuente que el servidor)", () => {
    for (const a of ["nuevo_analisis", "vincular", "reabrir", "desvincular"] as const) {
      expect(textoModalM1(a, completo).lineas).toEqual(lineasImpactoM1(completo, a));
    }
  });
  it("ningún texto usa palabras internas", () => {
    const todo = (["nuevo_analisis", "vincular", "reabrir", "desvincular"] as const)
      .map((a) => { const t = textoModalM1(a, completo, { nombre: "X" }); return [t.titulo, ...t.intro, ...t.lineas, t.cierre ?? "", t.confirmar].join(" "); })
      .join(" ") + MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES;
    expect(todo).not.toMatch(/huella|payload|linkedSource|draftDVS|undefined/i);
    expect(todo).not.toMatch(/\bDIE\b/);
  });
  it("mensaje de rechazo del vincular desde Centinela, literal", () => {
    expect(MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES).toBe(
      "Este proyecto tiene un análisis con ediciones o aprobación. Ábrelo en Moddulo y usa «Vincular con análisis independiente» para confirmar el reemplazo."
    );
  });
});

describe("mensajeRechazoVincularCentinela", () => {
  it("con los 409 de confirmación muestra el texto acordado; con otros códigos o estados, null", async () => {
    const { mensajeRechazoVincularCentinela } = await import("./textosModalM1");
    expect(mensajeRechazoVincularCentinela({ status: 409, codigo: "reemplazo_requiere_confirmacion" })).toBe(MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES);
    expect(mensajeRechazoVincularCentinela({ status: 409, codigo: "reemplazo_huella_vencida" })).toBe(MENSAJE_VINCULAR_CENTINELA_CON_EDICIONES);
    expect(mensajeRechazoVincularCentinela({ status: 409, codigo: "pestel_already_linked" })).toBeNull();
    expect(mensajeRechazoVincularCentinela({ status: 500, codigo: "reemplazo_requiere_confirmacion" })).toBeNull();
  });
});
