// lib/geo/desambiguar.test.ts
// Reference resolution core (26-09-23, step 1). Real cases measured against the live
// catalog of 2,477 municipalities (snapshot in __fixtures__/municipios_catalogo.json):
// exact-first, single partial resolves, several → ask, too many → ask for the state,
// the type dimension (state vs municipality) is left to the caller, "México" always asks.

import { describe, expect, it } from "vitest";
import catalogo from "./__fixtures__/municipios_catalogo.json";
import { ALIAS_MUNICIPIO, claveCanonicaMunicipio } from "./municipioCanonico";
import {
  desambiguarReferencia,
  MAX_CANDIDATOS_POR_DEFECTO,
  type CandidatoReferencia,
  type MunicipioCatalogoRef,
  type ResultadoDesambiguacion,
} from "./desambiguar";

// The fixture has no `cve`; give the 4 same-name rows their INE cve (208/209, 316/317) the way
// getMunicipiosOptionsNacional() does, in catalog order.
const CVE_PARES: Record<string, [string, string]> = {
  "20:SAN JUAN MIXTEPEC": ["208", "209"],
  "20:SAN PEDRO MIXTEPEC": ["316", "317"],
};
const contador: Record<string, number> = {};
const MUNICIPIOS: MunicipioCatalogoRef[] = (catalogo as MunicipioCatalogoRef[]).map((m) => {
  const k = `${m.estadoCve}:${m.nombre}`;
  const par = CVE_PARES[k];
  if (!par) return m;
  contador[k] = (contador[k] ?? 0) + 1;
  return { ...m, cve: par[contador[k] - 1] };
});

const MUN = { municipios: MUNICIPIOS, tipos: ["municipio"] as const };

function unico(r: ResultadoDesambiguacion): CandidatoReferencia {
  expect(r.estado).toBe("unico");
  return (r as Extract<ResultadoDesambiguacion, { estado: "unico" }>).candidato;
}
function lista(r: ResultadoDesambiguacion): CandidatoReferencia[] {
  expect(r.estado).toBe("ambiguo");
  return (r as Extract<ResultadoDesambiguacion, { estado: "ambiguo" }>).candidatos;
}
const claves = (cs: CandidatoReferencia[]) => cs.map((c) => c.clave);

describe("catálogo de prueba", () => {
  it("es el catálogo real: 2,477 municipios de 32 estados", () => {
    expect(MUNICIPIOS).toHaveLength(2477);
    expect(new Set(MUNICIPIOS.map((m) => m.estadoCve)).size).toBe(32);
  });
});

describe("parcial única: resuelve sola, con el nombre oficial y coincidencia 'parcial'", () => {
  it.each([
    ["Pachuca", "13:PACHUCA DE SOTO", "Pachuca de Soto, Hidalgo"],
    ["Tlajomulco", "14:TLAJOMULCO DE ZUÑIGA", "Tlajomulco de Zuñiga, Jalisco"],
    ["Vallarta", "14:PUERTO VALLARTA", "Puerto Vallarta, Jalisco"],
    ["Tuxtepec", "20:SAN JUAN BAUTISTA TUXTEPEC", "San Juan Bautista Tuxtepec, Oaxaca"],
    ["Naucalpan", "15:NAUCALPAN DE JUAREZ", "Naucalpan De Juarez, Estado de México"],
  ])("%s → %s", (texto, clave) => {
    const c = unico(desambiguarReferencia(texto, MUN));
    expect(c.clave).toBe(clave);
    expect(c.tipo).toBe("municipio");
    expect(c.coincidencia).toBe("parcial");
  });

  it("acepta acentos y mayúsculas indistintamente", () => {
    expect(unico(desambiguarReferencia("  PÁCHUCA ", MUN)).clave).toBe("13:PACHUCA DE SOTO");
  });
});

describe("alias: la forma coloquial resuelve como exacta-por-alias, no como parcial", () => {
  it("Tlaquepaque → San Pedro Tlaquepaque", () => {
    const c = unico(desambiguarReferencia("Tlaquepaque", MUN));
    expect(c.clave).toBe("14:SAN PEDRO TLAQUEPAQUE");
    expect(c.coincidencia).toBe("alias");
  });

  it.each([
    ["Edomex", "15"],
    ["CDMX", "09"],
  ])("%s → estado %s (alias)", (texto, cve) => {
    const c = unico(desambiguarReferencia(texto, { municipios: MUNICIPIOS }));
    expect(c).toMatchObject({ tipo: "estado", clave: cve, coincidencia: "alias" });
  });
});

describe("ambigüedad genuina: varias entidades reales → se pregunta con la lista", () => {
  it("Ixtlahuacán en Jalisco: 2 candidatos (del Río / de los Membrillos)", () => {
    const cs = lista(desambiguarReferencia("Ixtlahuacán", { ...MUN, estadoCve: "14" }));
    expect(claves(cs)).toEqual(["14:IXTLAHUACAN DE LOS MEMBRILLOS", "14:IXTLAHUACAN DEL RIO"]);
    expect(cs.every((c) => c.coincidencia === "parcial")).toBe(true);
  });

  it("Tuxtla: 4 candidatos parciales de 2 estados", () => {
    const cs = lista(desambiguarReferencia("Tuxtla", MUN));
    expect(claves(cs).sort()).toEqual([
      "07:TUXTLA CHICO",
      "07:TUXTLA GUTIERREZ",
      "30:SAN ANDRES TUXTLA",
      "30:SANTIAGO TUXTLA",
    ]);
  });

  it("Salto: El Salto (Jalisco) y Salto de Agua (Chiapas)", () => {
    expect(claves(lista(desambiguarReferencia("Salto", MUN))).sort()).toEqual(["07:SALTO DE AGUA", "14:EL SALTO"]);
  });

  it("Ocampo: 6 municipios exactos en 6 estados", () => {
    const cs = lista(desambiguarReferencia("Ocampo", MUN));
    expect(cs).toHaveLength(6);
    expect(cs.every((c) => c.coincidencia === "exacta")).toBe(true);
    expect(cs.map((c) => c.estadoCve).sort()).toEqual(["05", "08", "10", "11", "16", "28"]);
  });

  it("Guadalupe: 4 exactos, ignora los 8 que solo lo contienen", () => {
    const cs = lista(desambiguarReferencia("Guadalupe", MUN));
    expect(cs).toHaveLength(4);
    expect(cs.every((c) => c.coincidencia === "exacta")).toBe(true);
  });

  it("dar el estado desambigua: Ocampo en Chihuahua → único", () => {
    const c = unico(desambiguarReferencia("Ocampo", { ...MUN, estadoCve: "08" }));
    expect(c.clave).toBe("08:OCAMPO");
  });
});

describe("exacta primero: los parciales sobran cuando hay exactas", () => {
  it("Cuauhtémoc: 4 exactos (los 5 que lo contienen se ignoran)", () => {
    const cs = lista(desambiguarReferencia("Cuauhtémoc", MUN));
    expect(cs).toHaveLength(4);
    expect(cs.every((c) => c.coincidencia === "exacta")).toBe(true);
    expect(cs.map((c) => c.estadoCve).sort()).toEqual(["06", "08", "09", "32"]);
  });

  it("Juárez: 5 exactos (los 28 que lo contienen se ignoran)", () => {
    const cs = lista(desambiguarReferencia("Juárez", MUN));
    expect(cs).toHaveLength(5);
    expect(cs.every((c) => c.coincidencia === "exacta")).toBe(true);
  });

});

describe("exacto único + parciales: NO resuelve solo, pregunta con el exacto primero (decisión 26-09-24)", () => {
  it("Santiago: existe el municipio SANTIAGO (NL) pero 64 más lo contienen → demasiados, y el exacto viaja en `exactas`", () => {
    const r = desambiguarReferencia("Santiago", MUN);
    expect(r.estado).toBe("demasiados");
    if (r.estado === "demasiados") {
      expect(r.total).toBe(65);
      expect(r.exactas.map((c) => c.clave)).toEqual(["19:SANTIAGO"]);
      expect(r.exactas[0].coincidencia).toBe("exacta");
    }
  });

  it("San Pedro: 1 exacto (Coahuila) + 49 parciales → demasiados con el exacto en `exactas`", () => {
    const r = desambiguarReferencia("San Pedro", MUN);
    expect(r).toMatchObject({ estado: "demasiados", total: 50 });
    if (r.estado === "demasiados") expect(r.exactas.map((c) => c.clave)).toEqual(["05:SAN PEDRO"]);
  });

  it.each([
    ["Candelaria", ["04:CANDELARIA", "20:CANDELARIA LOXICHA"]],
    ["Miguel Hidalgo", ["09:MIGUEL HIDALGO", "29:ACUAMANALA DE MIGUEL HIDALGO"]],
    ["Lerdo", ["10:LERDO", "30:LERDO DE TEJADA"]],
    ["Juchitán", ["12:JUCHITAN", "20:HEROICA CIUDAD DE JUCHITAN DE ZARAGOZA"]],
  ])("%s: ≤8 candidatos → ambiguo, el exacto es la PRIMERA opción", (texto, esperadas) => {
    const cs = lista(desambiguarReferencia(texto, MUN));
    expect(claves(cs)).toEqual(esperadas);
    expect(cs[0].coincidencia).toBe("exacta");
    expect(cs.slice(1).every((c) => c.coincidencia === "parcial")).toBe(true);
  });

  it("Escobedo: 1 exacto + 6 parciales = 7 → ambiguo con el exacto primero", () => {
    const cs = lista(desambiguarReferencia("Escobedo", MUN));
    expect(cs).toHaveLength(7);
    expect(cs[0]).toMatchObject({ clave: "05:ESCOBEDO", coincidencia: "exacta" });
  });

  it("dentro de un estado sin parciales el exacto SÍ resuelve solo (Santiago en Nuevo León, Ocampo en Chihuahua)", () => {
    expect(unico(desambiguarReferencia("Santiago", { ...MUN, estadoCve: "19" })).clave).toBe("19:SANTIAGO");
    expect(unico(desambiguarReferencia("Ocampo", { ...MUN, estadoCve: "08" })).clave).toBe("08:OCAMPO");
  });

  it("sin regresión: exacto sin ningún parcial sigue resolviendo solo", () => {
    for (const [texto, clave] of [
      ["Zapopan", "14:ZAPOPAN"],
      ["Toluca", "15:TOLUCA"],
      ["Mérida", "31:MERIDA"],
      ["Guadalajara", "14:GUADALAJARA"],
    ] as const) {
      expect(unico(desambiguarReferencia(texto, MUN)).clave).toBe(clave);
    }
  });

  it("un alias exacto no se lista a sí mismo como parcial (Tlaquepaque → un solo candidato)", () => {
    const c = unico(desambiguarReferencia("Tlaquepaque", MUN));
    expect(c).toMatchObject({ clave: "14:SAN PEDRO TLAQUEPAQUE", coincidencia: "alias" });
  });

  it("con 2+ exactos la regla no cambia: solo se listan los exactos (Cuauhtémoc, Juárez)", () => {
    expect(lista(desambiguarReferencia("Cuauhtémoc", MUN))).toHaveLength(4);
    expect(lista(desambiguarReferencia("Juárez", MUN))).toHaveLength(5);
  });
});

describe("tope de candidatos (8): más de 8 no se lista, se pide el estado", () => {
  it("San Juan (63 municipios, ninguno exacto) → demasiados", () => {
    const r = desambiguarReferencia("San Juan", MUN);
    expect(r.estado).toBe("demasiados");
    if (r.estado === "demasiados") {
      expect(r.total).toBe(63);
      expect(r.estadosCve.length).toBeGreaterThan(8);
    }
  });

  it("Villa (46) → demasiados", () => {
    expect(desambiguarReferencia("Villa", MUN)).toMatchObject({ estado: "demasiados", total: 46 });
  });

  it("dar el estado convierte un demasiados en una lista corta o un único", () => {
    const r = desambiguarReferencia("San Juan", { ...MUN, estadoCve: "14" });
    expect(["unico", "ambiguo"]).toContain(r.estado);
  });

  it("el borde es exactamente 8: 8 candidatos se listan, 9 no", () => {
    const sintetico = (n: number): MunicipioCatalogoRef[] =>
      Array.from({ length: n }, (_, i) => ({
        estadoCve: String(i + 1).padStart(2, "0"),
        nombre: `ZETA ${String.fromCharCode(65 + i)}`,
      }));
    expect(MAX_CANDIDATOS_POR_DEFECTO).toBe(8);
    expect(desambiguarReferencia("Zeta", { municipios: sintetico(8), tipos: ["municipio"] }).estado).toBe("ambiguo");
    expect(desambiguarReferencia("Zeta", { municipios: sintetico(9), tipos: ["municipio"] })).toMatchObject({
      estado: "demasiados",
      total: 9,
    });
  });

  it("el tope es configurable", () => {
    expect(desambiguarReferencia("Ocampo", { ...MUN, maxCandidatos: 3 }).estado).toBe("demasiados");
  });
});

describe("nombres idénticos dentro de un estado (San Juan / San Pedro Mixtepec)", () => {
  it("San Juan Mixtepec: 2 candidatos distinguibles, con sufijo #cve y el distrito en la etiqueta", () => {
    const cs = lista(desambiguarReferencia("San Juan Mixtepec", MUN));
    expect(claves(cs)).toEqual(["20:SAN JUAN MIXTEPEC#208", "20:SAN JUAN MIXTEPEC#209"]);
    expect(cs.map((c) => c.etiqueta)).toEqual([
      "San Juan Mixtepec, Oaxaca (Dto. 08)",
      "San Juan Mixtepec, Oaxaca (Dto. 26)",
    ]);
  });

  it("San Pedro Mixtepec igual, y sin cve en el catálogo cae a un ordinal", () => {
    expect(claves(lista(desambiguarReferencia("San Pedro Mixtepec", MUN)))).toEqual([
      "20:SAN PEDRO MIXTEPEC#316",
      "20:SAN PEDRO MIXTEPEC#317",
    ]);
    const sinCve = (catalogo as MunicipioCatalogoRef[]);
    expect(claves(lista(desambiguarReferencia("San Pedro Mixtepec", { municipios: sinCve, tipos: ["municipio"] })))).toEqual([
      "20:SAN PEDRO MIXTEPEC#1",
      "20:SAN PEDRO MIXTEPEC#2",
    ]);
  });

  it("solo esos 4 municipios llevan sufijo: el resto de las claves es por nombre", () => {
    expect(unico(desambiguarReferencia("Zapopan", MUN)).clave).toBe("14:ZAPOPAN");
  });
});

describe("cruce estado / municipio: la dimensión de tipo la decide quien llama", () => {
  it("Oaxaca sin acotar: el estado y Oaxaca de Juárez (parcial) → se pregunta el tipo", () => {
    const cs = lista(desambiguarReferencia("Oaxaca", { municipios: MUNICIPIOS, tipos: ["estado", "municipio"] }));
    expect(cs.map((c) => [c.tipo, c.clave, c.coincidencia])).toEqual([
      ["estado", "20", "exacta"],
      ["municipio", "20:OAXACA DE JUAREZ", "parcial"],
    ]);
  });

  it("Oaxaca con tipos:['municipio'] → único; con tipos:['estado'] → único", () => {
    expect(unico(desambiguarReferencia("Oaxaca", MUN)).clave).toBe("20:OAXACA DE JUAREZ");
    expect(unico(desambiguarReferencia("Oaxaca", { municipios: MUNICIPIOS, tipos: ["estado"] })).clave).toBe("20");
  });

  it.each(["Colima", "Querétaro", "Puebla", "Zacatecas"])("%s: estado y municipio homónimos (exactos) → ambiguo por tipo", (t) => {
    const cs = lista(desambiguarReferencia(t, { municipios: MUNICIPIOS, tipos: ["estado", "municipio"] }));
    expect(cs.map((c) => c.tipo).sort()).toEqual(["estado", "municipio"]);
    expect(cs.every((c) => c.coincidencia !== "parcial")).toBe(true);
  });

  it("sin acotar tipos también aparecen los distritos (Colima: estado, municipio y 4 distritos)", () => {
    const cs = lista(desambiguarReferencia("Colima", { municipios: MUNICIPIOS }));
    expect(new Set(cs.map((c) => c.tipo))).toEqual(
      new Set(["estado", "municipio", "distrito_federal", "distrito_local"])
    );
  });

  it("Mérida sin acotar son 13 (estado no, municipio 1, distritos varios) → demasiados; acotada a municipio → único", () => {
    expect(desambiguarReferencia("Mérida", { municipios: MUNICIPIOS }).estado).toBe("demasiados");
    expect(unico(desambiguarReferencia("Mérida", MUN)).clave).toBe("31:MERIDA");
  });
});

describe("'México' siempre pregunta: país o Estado de México", () => {
  it("sin contexto → ambiguo entre el país (MEX) y el estado (15), sin ruido de distritos", () => {
    const cs = lista(desambiguarReferencia("México", { municipios: MUNICIPIOS }));
    expect(cs.map((c) => [c.tipo, c.clave])).toEqual([
      ["pais", "MEX"],
      ["estado", "15"],
    ]);
  });

  it("'mexico' sin acento y en mayúsculas también pregunta", () => {
    expect(desambiguarReferencia("MEXICO", { municipios: MUNICIPIOS }).estado).toBe("ambiguo");
  });

  it("mexico:'pais' o mexico:'estado' lo fijan; acotar tipos también", () => {
    expect(unico(desambiguarReferencia("México", { mexico: "pais" })).clave).toBe("MEX");
    expect(unico(desambiguarReferencia("México", { mexico: "estado" })).clave).toBe("15");
    expect(unico(desambiguarReferencia("México", { tipos: ["estado"] })).clave).toBe("15");
    expect(unico(desambiguarReferencia("México", { tipos: ["pais"] })).clave).toBe("MEX");
  });

  it("dentro de un estado ya dado no es el país", () => {
    const r = desambiguarReferencia("México", { estadoCve: "15", municipios: MUNICIPIOS });
    expect(r.estado).toBe("unico");
    expect(unico(r).tipo).toBe("estado");
  });

  it("MEX es solo del país: 'Edomex' y 'Estado de México' resuelven a 15", () => {
    expect(unico(desambiguarReferencia("Estado de México", {})).clave).toBe("15");
    expect(unico(desambiguarReferencia("Edomex", {})).clave).toBe("15");
  });
});

describe("alias coloquiales reales y permanentes (26-09-24)", () => {
  it.each([
    ["Ciudad Juárez", "08:JUAREZ"],
    ["ciudad juarez", "08:JUAREZ"],
    ["Cd. Juárez", "08:JUAREZ"],
    ["Neza", "15:NEZAHUALCOYOTL"],
    ["NEZA", "15:NEZAHUALCOYOTL"],
  ])("%s → %s (coincidencia 'alias')", (texto, clave) => {
    const c = unico(desambiguarReferencia(texto, MUN));
    expect(c).toMatchObject({ tipo: "municipio", clave, coincidencia: "alias" });
  });

  it("funciona con o sin estado dado; el estado equivocado no lo resuelve", () => {
    expect(unico(desambiguarReferencia("Ciudad Juárez", { ...MUN, estadoCve: "08" })).clave).toBe("08:JUAREZ");
    expect(unico(desambiguarReferencia("Neza", { ...MUN, estadoCve: "15" })).clave).toBe("15:NEZAHUALCOYOTL");
    expect(desambiguarReferencia("Neza", { ...MUN, estadoCve: "14" })).toEqual({ estado: "ninguno" });
  });

  it("sin acotar tipos, 'Ciudad Juárez' incluye el municipio de Chihuahua y ningún otro Juárez", () => {
    const r = desambiguarReferencia("Ciudad Juárez", { municipios: MUNICIPIOS });
    const claves = r.estado === "unico" ? [r.candidato.clave] : r.estado === "ambiguo" ? r.candidatos.map((c) => c.clave) : [];
    expect(claves).toContain("08:JUAREZ");
    expect(claves).not.toContain("05:JUAREZ");
    expect(claves).not.toContain("07:JUAREZ");
  });

  it("el alias no cambia 'Juárez' (siguen siendo los 5 municipios exactos) ni 'Nezahualcóyotl'", () => {
    expect(lista(desambiguarReferencia("Juárez", MUN))).toHaveLength(5);
    expect(unico(desambiguarReferencia("Nezahualcóyotl", MUN))).toMatchObject({
      clave: "15:NEZAHUALCOYOTL",
      coincidencia: "exacta",
    });
  });

  it("los alias coloquiales viven en su propia tabla: ALIAS_MUNICIPIO (contrato de joins de datos) no cambia", () => {
    expect(ALIAS_MUNICIPIO["08"]?.["CIUDAD JUAREZ"]).toBeUndefined();
    expect(ALIAS_MUNICIPIO["15"]?.["NEZA"]).toBeUndefined();
    expect(claveCanonicaMunicipio("15", "Neza")).toBe("NEZA");
  });
});

describe("errores de tecleo: NO se adivinan (mejora aparte documentada, ver CLAUDE.md)", () => {
  it.each(["Guadalajra", "Guadalajarra", "Zapoppan", "Tlajomulko"])("%s → ninguno (nunca resuelve solo)", (texto) => {
    expect(desambiguarReferencia(texto, MUN)).toEqual({ estado: "ninguno" });
  });

  it("el nombre bien escrito sí resuelve", () => {
    expect(unico(desambiguarReferencia("Guadalajara", MUN)).clave).toBe("14:GUADALAJARA");
  });
});

describe("ninguno: lo que no se reconoce no se adivina", () => {
  it.each([
    ["Guadalajra", MUN],
    ["Narnia", MUN],
    ["Santiago", { ...MUN, estadoCve: "14" }],
  ])("%s → ninguno", (texto, opts) => {
    expect(desambiguarReferencia(texto, opts)).toEqual({ estado: "ninguno" });
  });

  it("vacío, espacios, undefined y el centinela 'Nacional' → ninguno", () => {
    for (const t of ["", "   ", undefined, null, "Nacional", "NACIONAL"]) {
      expect(desambiguarReferencia(t, MUN)).toEqual({ estado: "ninguno" });
    }
  });

  it("un texto de menos de 3 letras no dispara coincidencia parcial", () => {
    expect(desambiguarReferencia("El", MUN).estado).toBe("ninguno");
  });

  it("sin catálogo inyectado no se buscan municipios", () => {
    expect(desambiguarReferencia("Pachuca", { tipos: ["municipio"] })).toEqual({ estado: "ninguno" });
  });
});

describe("forma del resultado", () => {
  it("cada candidato lleva clave estable, tipo, nombre, etiqueta y coincidencia", () => {
    const c = unico(desambiguarReferencia("Pachuca", MUN));
    expect(c).toEqual({
      tipo: "municipio",
      clave: "13:PACHUCA DE SOTO",
      estadoCve: "13",
      nombre: "Pachuca de Soto",
      etiqueta: "Pachuca de Soto, Hidalgo",
      coincidencia: "parcial",
    });
  });

  it("orden estable: país, estado, municipio, distrito federal, distrito local; dentro del tipo por clave", () => {
    const cs = lista(desambiguarReferencia("Colima", { municipios: MUNICIPIOS }));
    const orden = ["pais", "estado", "municipio", "distrito_federal", "distrito_local"];
    expect(cs.map((c) => orden.indexOf(c.tipo))).toEqual([...cs.map((c) => orden.indexOf(c.tipo))].sort((a, b) => a - b));
  });

  it("es determinista: la misma entrada da el mismo resultado", () => {
    expect(desambiguarReferencia("Tuxtla", MUN)).toEqual(desambiguarReferencia("Tuxtla", MUN));
  });
});
