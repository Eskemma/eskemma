import { describe, expect, it } from "vitest";
import type { Territorio } from "@/types/shared.types";
import { bloqueTerritorioModdulo, TOPE_UNIDADES_PROMPT_MODDULO, unidadesPlurales } from "./bloqueTerritorio";
import { construirSystemPromptFontana } from "@/lib/fontana/agente/systemPrompt";

const NACIONAL: Territorio = { nivel: "nacional", nombre: "México", pais: "México" };
const ESTATAL: Territorio = { nivel: "estatal", nombre: "Jalisco", estado: "Jalisco", pais: "México" };
const DF_PROGRESO: Territorio = {
  nivel: "distrito_federal",
  nombre: "PROGRESO",
  estado: "Yucatán",
  pais: "México",
  cve_distrito: "002",
  distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }],
};
const DL_IZTAPALAPA: Territorio = {
  nivel: "distrito_local",
  nombre: "IZTAPALAPA",
  estado: "Ciudad de México",
  distritosSeleccionados: [{ cve: "027", nombre: "IZTAPALAPA", estado: "Ciudad de México" }],
};
const ZMG10 = [
  "Guadalajara", "Zapopan", "San Pedro Tlaquepaque", "Tonalá", "Tlajomulco de Zúñiga",
  "El Salto", "Juanacatlán", "Ixtlahuacán de los Membrillos", "Acatlán de Juárez", "Zapotlanejo",
].map((nombre) => ({ nombre, estado: "Jalisco", clave: `14:${nombre.toUpperCase()}` }));
const ZMG: Territorio = {
  nivel: "municipal",
  nombre: "ZMG",
  estado: "Jalisco",
  municipio: "Guadalajara",
  pais: "México",
  municipiosPorEstado: ZMG10,
};

describe("bloqueTerritorioModdulo", () => {
  it("sin territorio (proyecto legado) → cadena vacía: el prompt no cambia", () => {
    expect(bloqueTerritorioModdulo(undefined)).toBe("");
    expect(bloqueTerritorioModdulo(null)).toBe("");
  });

  it("nacional", () => {
    const b = bloqueTerritorioModdulo(NACIONAL);
    expect(b).toContain("- Nivel: Nacional (todo México)");
    expect(b).toContain("- Territorio: México");
    expect(b).toContain("- País: México");
    expect(b).not.toContain("VARIAS unidades");
  });

  it("estatal", () => {
    const b = bloqueTerritorioModdulo(ESTATAL);
    expect(b).toContain("- Nivel: Estatal");
    expect(b).toContain("- Estado: Jalisco");
  });

  it("distrito federal en forma canónica D.F. 3102 PROGRESO (Yucatán)", () => {
    const b = bloqueTerritorioModdulo(DF_PROGRESO);
    expect(b).toContain("- Nivel: Distrito electoral federal");
    expect(b).toContain("- Territorio: D.F. 3102 PROGRESO (Yucatán)");
  });

  it("distrito local en forma canónica D.L. 0927 IZTAPALAPA (Ciudad de México)", () => {
    const b = bloqueTerritorioModdulo(DL_IZTAPALAPA);
    expect(b).toContain("- Territorio: D.L. 0927 IZTAPALAPA (Ciudad de México)");
  });

  it("ZMG (10 municipios) se lista completa por debajo del tope, con el total", () => {
    const b = bloqueTerritorioModdulo(ZMG);
    expect(b).toContain("VARIAS unidades (10)");
    expect(b).toContain("Zapotlanejo (Jalisco)");
    expect(b).not.toContain(" más.");
  });

  it("plural por encima del tope: lista TOPE y resume «y N más»", () => {
    const muchos: Territorio = {
      ...ZMG,
      municipiosPorEstado: Array.from({ length: 27 }, (_, i) => ({ nombre: `Mun ${i}`, estado: "Jalisco" })),
    };
    const b = bloqueTerritorioModdulo(muchos);
    expect(b).toContain("VARIAS unidades (27)");
    expect(b).toContain(`Mun ${TOPE_UNIDADES_PROMPT_MODDULO - 1} (Jalisco)`);
    expect(b).not.toContain(`Mun ${TOPE_UNIDADES_PROMPT_MODDULO} (Jalisco)`);
    expect(b).toContain(`y ${27 - TOPE_UNIDADES_PROMPT_MODDULO} más`);
    // Peor caso acotado (≈ 720 caracteres de bloque de unidades con 20 entradas).
    expect(b.length).toBeLessThan(1800);
  });

  it("legado sin plurales ni país: degrada a nombre/estado y dice 'país no declarado' sin inventarlo", () => {
    const b = bloqueTerritorioModdulo({ nivel: "municipal", nombre: "Progreso", estado: "Yucatán", municipio: "Progreso" });
    expect(b).toContain("- Municipio: Progreso");
    expect(b).toContain("País: no declarado");
    expect(b).not.toContain("VARIAS unidades");
  });

  it("extranjero sin claves ni catálogo: no inventa claves ni estado mexicano", () => {
    const b = bloqueTerritorioModdulo({
      nivel: "municipal",
      nombre: "Bogotá",
      pais: "Colombia",
      municipiosPorEstado: [
        { nombre: "Nueva Granada", estado: "Magdalena" },
        { nombre: "Ciénaga", estado: "Magdalena" },
      ],
    });
    expect(b).toContain("- País: Colombia");
    expect(b).toContain("Nueva Granada (Magdalena), Ciénaga (Magdalena)");
    expect(b).not.toMatch(/\d{2}:[A-Z]/); // sin claves estables
  });

  it("incluye las reglas: 'este distrito' = el del bloque, confirmar otro lugar, el chat no edita", () => {
    const b = bloqueTerritorioModdulo(DF_PROGRESO);
    expect(b).toContain("«Este distrito»");
    expect(b).toContain("confirma si se trata de otro territorio");
    expect(b).toContain("No puedes modificar el territorio desde el chat");
  });
});

describe("unidadesPlurales", () => {
  it("singular → null; sin tope lista todas (comportamiento de Fontana)", () => {
    expect(unidadesPlurales(ESTATAL)).toBeNull();
    expect(unidadesPlurales(ZMG)?.total).toBe(10);
    expect(unidadesPlurales(ZMG)?.lista.split(", ")).toHaveLength(10);
  });
});

describe("Fontana no sufre regresión tras la extracción", () => {
  it("el bloque de territorio de Fontana conserva exactamente su forma", () => {
    const p = construirSystemPromptFontana(DF_PROGRESO, "legislativo");
    expect(p).toContain(
      [
        "## Territorio de esta sesión (fijo — todas las consultas son sobre este)",
        "- Nivel: Distrito electoral federal",
        "- Territorio: D.F. 3102 PROGRESO (Yucatán)",
        "- Estado: Yucatán",
        "- Tipo de proyecto: legislativo",
      ].join("\n")
    );
    const plural = construirSystemPromptFontana(ZMG, "gubernamental");
    expect(plural).toContain(
      "- Este proyecto abarca VARIAS unidades: " +
        ZMG10.map((m) => `${m.nombre} (${m.estado})`).join(", ") +
        ". Los valores combinados los calcula la herramienta; nunca los combines tú."
    );
  });
});
