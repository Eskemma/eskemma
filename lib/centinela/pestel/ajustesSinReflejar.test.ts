// T3: ¿qué ajustes del analista NO están reflejados en el mapa que F2 importó? Antes la pantalla de Interpretación
// afirmaba SIEMPRE «F2 todavía no incluye tus ajustes» con el proyecto vinculado (falso si el mapa ya los traía).
import { describe, expect, it } from "vitest";
import { ajustesDelMapaImportado, ajustesSinReflejarEnF2, listaEnEspanol } from "./ajustesSinReflejar";

const adj = (dimensionCode: string, newClassification = "OPORTUNIDAD", justification = "Porque sí, con razones") => ({ dimensionCode, newClassification, justification });
const imp = (ajustes: Record<string, { clasificacionAjustada?: string; justificacion?: string }>) => ({ ajustes });

describe("ajustesSinReflejarEnF2", () => {
  it("sin ajustes en el análisis: nada que avisar", () => {
    expect(ajustesSinReflejarEnF2([], imp({}))).toEqual([]);
    expect(ajustesSinReflejarEnF2(undefined, imp({}))).toEqual([]);
  });
  it("ajustes reflejados (misma clasificación y justificación): nada que avisar", () => {
    expect(ajustesSinReflejarEnF2([adj("P")], imp({ P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "Porque sí, con razones" } }))).toEqual([]);
  });
  it("la justificación se compara recortada", () => {
    expect(ajustesSinReflejarEnF2([adj("P", "OPORTUNIDAD", "  Porque sí, con razones ")], imp({ P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "Porque sí, con razones" } }))).toEqual([]);
  });
  it("ajuste faltante en el mapa importado: esa dimensión", () => {
    expect(ajustesSinReflejarEnF2([adj("P"), adj("E")], imp({ P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "Porque sí, con razones" } }))).toEqual(["E"]);
  });
  it("ajuste cambiado después de importar (otra clasificación o otra justificación): esa dimensión", () => {
    const base = imp({ P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "Porque sí, con razones" } });
    expect(ajustesSinReflejarEnF2([adj("P", "NEUTRAL")], base)).toEqual(["P"]);
    expect(ajustesSinReflejarEnF2([adj("P", "OPORTUNIDAD", "Otra razón distinta")], base)).toEqual(["P"]);
  });
  it("un ajuste NUEVO posterior a la importación hace reaparecer el aviso solo para esa dimensión", () => {
    const base = imp({ P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "Porque sí, con razones" } });
    expect(ajustesSinReflejarEnF2([adj("P")], base)).toEqual([]);
    expect(ajustesSinReflejarEnF2([adj("P"), adj("L", "AMENAZA", "Nuevo ajuste posterior")], base)).toEqual(["L"]);
  });
  it("mapa Express (sin ningún ajuste): todas las dimensiones ajustadas están sin reflejar", () => {
    expect(ajustesSinReflejarEnF2([adj("P"), adj("E")], imp({}))).toEqual(["P", "E"]);
  });
  it("no se pudo leer el mapa importado (null/undefined): no afirma nada", () => {
    expect(ajustesSinReflejarEnF2([adj("P")], null)).toEqual([]);
    expect(ajustesSinReflejarEnF2([adj("P")], undefined)).toEqual([]);
  });
  it("conserva el orden de los ajustes y no repite dimensiones", () => {
    expect(ajustesSinReflejarEnF2([adj("S"), adj("P"), adj("S")], imp({}))).toEqual(["S", "P"]);
  });
});

describe("ajustesDelMapaImportado (proyección mínima)", () => {
  it("solo el ajuste de cada dimensión; sin claves undefined; sin ajuste → vacío", () => {
    const payload = {
      P: { code: "P", clasificacion: "OPORTUNIDAD", narrativa: "no debe salir", ajuste: { clasificacionOriginal: "AMENAZA", clasificacionAjustada: "OPORTUNIDAD", justificacion: "j", ajustadoEn: "2026-10-20" } },
      E: { code: "E", clasificacion: "NEUTRAL" },
      L: { code: "L", ajuste: { clasificacionOriginal: "AMENAZA" } },
    };
    const r = ajustesDelMapaImportado(payload);
    expect(r).toEqual({ ajustes: { P: { clasificacionAjustada: "OPORTUNIDAD", justificacion: "j" }, L: {} } });
    expect(JSON.stringify(r)).not.toContain("no debe salir");
  });
  it("payload ausente o raro → vacío (no lanza)", () => {
    expect(ajustesDelMapaImportado(undefined)).toEqual({ ajustes: {} });
    expect(ajustesDelMapaImportado("x")).toEqual({ ajustes: {} });
    expect(ajustesDelMapaImportado({ P: null })).toEqual({ ajustes: {} });
  });
});

describe("listaEnEspanol", () => {
  it("una, dos y varias", () => {
    expect(listaEnEspanol(["Político"])).toBe("Político");
    expect(listaEnEspanol(["Político", "Económico"])).toBe("Político y Económico");
    expect(listaEnEspanol(["A", "B", "C"])).toBe("A, B y C");
  });
});
