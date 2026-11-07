// T7 C2 — textos del gate de origen: reales, sin huecos, con un control que existe en pantalla.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVISO_ORIGEN_VENCIDO_IMPORT, AVISO_ORIGEN_VENCIDO_SIN_RAZONES, AVISO_ORIGEN_VENCIDO_VINCULO, CONFIRMAR_ORIGEN, avisosDeOrigenParaModal, fechaLarga, leerRazonesOrigen, notaDeImportacion, textoRazon, textosDeRazones } from "./textosOrigen";
import type { RazonImportabilidad } from "./importabilidad";

const TODAS: RazonImportabilidad[] = [
  { tipo: "no_aprobado", status: "REVIEWED" },
  { tipo: "sesgos_sin_revisar", cantidad: 2 },
  { tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z", fechaVigente: "2026-11-02T08:30:00.000Z" },
  { tipo: "confianza_baja", confianza: 39 },
];

describe("fechaLarga", () => {
  it("formatea una fecha real y devuelve null si no es legible", () => {
    expect(fechaLarga("2026-10-01T10:00:00.000Z")).toBe("1 de octubre de 2026");
    expect(fechaLarga(undefined)).toBeNull();
    expect(fechaLarga("basura")).toBeNull();
  });
});

describe("textoRazon — la versión más nueva lleva la fecha real y nunca un hueco", () => {
  it("con ambas fechas", () => {
    expect(textoRazon(TODAS[2])).toBe(
      "Este análisis (del 1 de octubre de 2026) ya no es el vigente: hay uno más reciente (del 2 de noviembre de 2026). Para usar el vigente, ábrelo en Centinela y usa «Regresar a Moddulo F2 con resultados»."
    );
  });

  it("solo la fecha del propio análisis, solo la del vigente o ninguna: se dice sin lo que falta", () => {
    expect(textoRazon({ tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" })).toContain("(del 1 de octubre de 2026) ya no es el vigente del proyecto.");
    expect(textoRazon({ tipo: "no_vigente", fechaVigente: "2026-11-02T08:30:00.000Z" })).toContain("Este análisis ya no es el vigente: hay uno más reciente (del 2 de noviembre de 2026).");
    expect(textoRazon({ tipo: "no_vigente" })).toContain("Este análisis ya no es el vigente del proyecto.");
  });

  it("una fecha ilegible se trata como ausente (no queda «del .» ni «undefined»)", () => {
    const t = textoRazon({ tipo: "no_vigente", fechaAnalisis: "basura", fechaVigente: "x" });
    expect(t).not.toMatch(/\(del \)|del \.|undefined|null/);
    expect(t).toContain("Este análisis ya no es el vigente del proyecto.");
  });

  it("ningún texto de ninguna razón tiene huecos ni manda a soporte", () => {
    const todos = [...textosDeRazones(TODAS), textoRazon({ tipo: "no_vigente" }), textoRazon({ tipo: "sesgos_sin_revisar", cantidad: 1 }), textoRazon({ tipo: "no_aprobado" })];
    for (const t of todos) {
      expect(t).not.toMatch(/undefined|null|NaN|\(del \)|\bde \.|\s{2,}/);
      expect(t.toLowerCase()).not.toContain("soporte");
    }
  });

  it("singular y plural de los sesgos, y la confianza redondeada", () => {
    expect(textoRazon({ tipo: "sesgos_sin_revisar", cantidad: 1 })).toContain("1 alerta de sesgo sin revisar");
    expect(textoRazon({ tipo: "sesgos_sin_revisar", cantidad: 3 })).toContain("3 alertas de sesgo sin revisar");
    expect(textoRazon({ tipo: "confianza_baja", confianza: 39.4 })).toBe("La confianza global del análisis es de 39 %, por debajo del 50 % recomendado.");
  });
});

describe("los controles que nombran los textos existen en el código", () => {
  const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf-8");
  it("«Finalizar interpretación», «Marcar como revisado» y «Regresar a Moddulo F2 con resultados»", () => {
    expect(leer("app/centinela/pestel/[projectId]/interpretacion/page.tsx")).toContain("Finalizar interpretación");
    expect(leer("app/components/centinela/pestel/interpretacion/BiasCheckPanel.tsx")).toContain("Marcar como revisado");
    expect(leer("app/components/centinela/pestel/ModduloButton.tsx")).toContain("Regresar a Moddulo F2 con resultados");
  });
  it("cada control nombrado en los textos aparece en algún texto del gate", () => {
    const juntos = textosDeRazones(TODAS).join(" ");
    for (const c of ["«Finalizar interpretación»", "«Marcar como revisado»", "«Regresar a Moddulo F2 con resultados»"]) expect(juntos).toContain(c);
  });
});

describe("avisosDeOrigenParaModal — un solo mensaje por situación", () => {
  const AVISO_T4 = "Hay una versión más nueva del análisis PESTEL (v3, 2 de noviembre de 2026). Este proyecto usa v2.";
  const NO_VIGENTE: RazonImportabilidad = { tipo: "no_vigente", fechaAnalisis: "2026-10-01T10:00:00.000Z" };

  it("sin vínculo (primera importación) no_vigente se dice con su propio texto", () => {
    expect(avisosDeOrigenParaModal([NO_VIGENTE], undefined, AVISO_T4)).toEqual([textoRazon(NO_VIGENTE)]);
  });
  it("con version_nueva y solo no_vigente, el único mensaje es el del aviso de origen", () => {
    expect(avisosDeOrigenParaModal([NO_VIGENTE], "version_nueva", AVISO_T4)).toEqual([AVISO_T4]);
  });
  it("con version_nueva y otras razones, no_vigente no se repite y el aviso no se agrega", () => {
    const l = avisosDeOrigenParaModal([{ tipo: "no_aprobado" }, NO_VIGENTE], "version_nueva", AVISO_T4);
    expect(l).toEqual([textoRazon({ tipo: "no_aprobado" })]);
  });
  it("sin texto de aviso de origen y todo suprimido, la lista queda vacía (no se inventa)", () => {
    expect(avisosDeOrigenParaModal([NO_VIGENTE], "version_nueva", null)).toEqual([]);
  });
});

describe("leerRazonesOrigen y notaDeImportacion", () => {
  it("valida la forma y rechaza lo que no cuadra", () => {
    expect(leerRazonesOrigen(TODAS)).toEqual(TODAS);
    expect(leerRazonesOrigen("x")).toBeUndefined();
    expect(leerRazonesOrigen([{ tipo: "otra" }])).toBeUndefined();
    expect(leerRazonesOrigen([{ tipo: "sesgos_sin_revisar" }])).toBeUndefined();
    expect(leerRazonesOrigen([null])).toBeUndefined();
  });
  it("la nota: aviso si alguna razón pide confirmar; solo informa si es únicamente confianza baja; null sin razones", () => {
    expect(notaDeImportacion([])).toBeNull();
    expect(notaDeImportacion([{ tipo: "confianza_baja", confianza: 39 }])?.tono).toBe("info");
    expect(notaDeImportacion(TODAS)?.tono).toBe("aviso");
    expect(notaDeImportacion(TODAS)?.lineas).toEqual(textosDeRazones(TODAS));
  });
});

describe("avisos de «huella vencida» (el estado cambió entre lo que se vio y la confirmación)", () => {
  it("el texto exacto, que dice que NO se hizo nada y nombra el botón que se ve", () => {
    expect(AVISO_ORIGEN_VENCIDO_IMPORT).toBe("El estado del análisis de Centinela cambió. No se importó nada: revisa lo que se muestra y confirma de nuevo con «Importar de todos modos».");
    expect(AVISO_ORIGEN_VENCIDO_VINCULO).toBe("El estado del análisis de Centinela cambió. No se vinculó nada: revisa lo que se muestra y confirma de nuevo con «Importar de todos modos».");
    expect(CONFIRMAR_ORIGEN).toBe("Importar de todos modos");
  });

  it("cada aviso con botón nombra EXACTAMENTE el rótulo del botón de confirmar y afirma que no se hizo nada", () => {
    expect(AVISO_ORIGEN_VENCIDO_IMPORT).toContain(`«${CONFIRMAR_ORIGEN}»`);
    expect(AVISO_ORIGEN_VENCIDO_VINCULO).toContain(`«${CONFIRMAR_ORIGEN}»`);
    expect(AVISO_ORIGEN_VENCIDO_IMPORT).toContain("No se importó nada");
    expect(AVISO_ORIGEN_VENCIDO_VINCULO).toContain("No se vinculó nada");
  });

  it("sin razones legibles no hay botón «Importar de todos modos» en pantalla: el aviso no lo nombra, pero sigue diciendo que no se importó nada", () => {
    expect(AVISO_ORIGEN_VENCIDO_SIN_RAZONES).not.toContain(CONFIRMAR_ORIGEN);
    expect(AVISO_ORIGEN_VENCIDO_SIN_RAZONES).toContain("No se importó nada");
  });

  it("ninguno remite a soporte ni deja huecos", () => {
    for (const t of [AVISO_ORIGEN_VENCIDO_IMPORT, AVISO_ORIGEN_VENCIDO_VINCULO, AVISO_ORIGEN_VENCIDO_SIN_RAZONES]) expect(t).not.toMatch(/soporte|undefined|null|\s{2,}/i);
  });

  it("las pantallas usan las constantes (la frase no se vuelve a escribir en línea y se desvía)", () => {
    const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf-8");
    const f2 = leer("app/moddulo/proyecto/[projectId]/exploracion/page.tsx");
    const selector = leer("app/components/centinela/pestel/ModduloButton.tsx");
    expect(f2).not.toContain("El estado del análisis de Centinela cambió");
    expect(f2).toContain("avisoOrigenVencido(");
    expect(selector).not.toContain("El estado del análisis de Centinela cambió");
    expect(selector).toContain("AVISO_ORIGEN_VENCIDO_VINCULO");
    // El botón que el aviso nombra es el que el selector pinta.
    expect(selector).toContain("{CONFIRMAR_ORIGEN}");
  });
});

describe("confianza_baja — texto según la nota (T7 C3)", () => {
  const base = "La confianza global del análisis es de 39 %, por debajo del 50 % recomendado.";
  it("sin `nota` (no está aprobado): el texto de siempre, sin prometer ni negar justificación", () => {
    expect(textoRazon({ tipo: "confianza_baja", confianza: 39 })).toBe(base);
  });
  it("aprobado CON justificación: dice que la incluye", () => {
    expect(textoRazon({ tipo: "confianza_baja", confianza: 39, nota: "con_justificacion" })).toBe(`${base} Se aprobó con confianza baja; incluye la justificación del analista.`);
  });
  it("aprobado SIN justificación registrada: lo dice, no insinúa una nota", () => {
    const t = textoRazon({ tipo: "confianza_baja", confianza: 39, nota: "sin_justificacion" });
    expect(t).toBe(`${base} Se aprobó con confianza baja; no hay justificación registrada.`);
    expect(t).not.toContain("incluye la justificación");
  });
  it("leerRazonesOrigen acepta las dos formas de `nota` y rechaza cualquier otra", () => {
    expect(leerRazonesOrigen([{ tipo: "confianza_baja", confianza: 39, nota: "con_justificacion" }])).toHaveLength(1);
    expect(leerRazonesOrigen([{ tipo: "confianza_baja", confianza: 39 }])).toHaveLength(1);
    expect(leerRazonesOrigen([{ tipo: "confianza_baja", confianza: 39, nota: "x" }])).toBeUndefined();
  });
});
