// Pieza 1b — sugerencias por error de tecleo, con el catálogo real de 2,477 municipios.
import { describe, expect, it } from "vitest";
import catalogo from "./__fixtures__/municipios_catalogo.json";
import { desambiguarReferencia, type CandidatoReferencia, type MunicipioCatalogoRef, type ResultadoDesambiguacion } from "./desambiguar";
import { distanciaEdicion, MAX_SUGERENCIAS, MIN_LETRAS_SUGERENCIA } from "./sugerenciasTecleo";

const CVE_PARES: Record<string, [string, string]> = {
  "20:SAN JUAN MIXTEPEC": ["208", "209"],
  "20:SAN PEDRO MIXTEPEC": ["316", "317"],
};
const contador: Record<string, number> = {};
const MUN: MunicipioCatalogoRef[] = (catalogo as MunicipioCatalogoRef[]).map((m) => {
  const k = `${m.estadoCve}:${m.nombre}`;
  const par = CVE_PARES[k];
  if (!par) return m;
  contador[k] = (contador[k] ?? 0) + 1;
  return { ...m, cve: par[contador[k] - 1] };
});

const sug = (texto: string, extra: Parameters<typeof desambiguarReferencia>[1] = {}) =>
  desambiguarReferencia(texto, { municipios: MUN, sugerir: true, ...extra });
const sugerencias = (r: ResultadoDesambiguacion): CandidatoReferencia[] => (r.estado === "ninguno" ? r.sugerencias ?? [] : []);
const claves = (r: ResultadoDesambiguacion) => sugerencias(r).map((c) => c.clave);

describe("distanciaEdicion", () => {
  it("sustitución, inserción, borrado y transposición cuentan 1; dos ediciones superan el límite", () => {
    expect(distanciaEdicion("ZAPOPAN", "ZAPOAN")).toBe(1);
    expect(distanciaEdicion("ZAPOPAN", "ZAPOPANN")).toBe(1);
    expect(distanciaEdicion("ZAPOPAN", "ZAPUPAN")).toBe(1);
    expect(distanciaEdicion("ZAPOPAN", "ZAPOAPN")).toBe(1); // transposición de dos letras contiguas
    expect(distanciaEdicion("ZAPOPAN", "ZAPUPEN")).toBe(2); // dos sustituciones
    expect(distanciaEdicion("QUERETARO", "QUERETRAO")).toBe(1); // transposición real
    expect(distanciaEdicion("GUADALAJARA", "GUADLAJRA")).toBe(2);
    expect(distanciaEdicion("A", "ABCDE")).toBe(2); // corte por longitud
  });
});

describe("sugerencias por tecleo — casos reales", () => {
  it("«Guadalajra» en Jalisco → ninguno CON la sugerencia Guadalajara (marcada 'sugerida'; nunca 'unico')", () => {
    const r = sug("Guadalajra", { estadoCve: "14", tipos: ["municipio"] });
    expect(r.estado).toBe("ninguno");
    expect(claves(r)).toEqual(["14:GUADALAJARA"]);
    expect(sugerencias(r)[0]).toMatchObject({ nombre: "Guadalajara", coincidencia: "sugerida", etiqueta: "Guadalajara, Jalisco" });
  });

  it("«Zapoan» → Zapopan; «Tlaqepaque» → San Pedro Tlaquepaque (vía el alias real «Tlaquepaque»)", () => {
    expect(claves(sug("Zapoan", { estadoCve: "14", tipos: ["municipio"] }))).toEqual(["14:ZAPOPAN"]);
    const t = sug("Tlaqepaque", { estadoCve: "14", tipos: ["municipio"] });
    expect(claves(t)).toEqual(["14:SAN PEDRO TLAQUEPAQUE"]);
  });

  it("«Queretro» sin acotar tipo: el estado Y el municipio de Querétaro (dos sugerencias, el usuario decide)", () => {
    const r = sug("Queretro", { tipos: ["estado", "municipio"] });
    expect(sugerencias(r).map((c) => `${c.tipo}:${c.clave}`)).toEqual(["estado:22", "municipio:22:QUERETARO"]);
  });

  it("«Colixa» está a 1 de Colima Y de Colipa: se listan los tres (estado, municipio y Colipa) → nunca resuelve solo", () => {
    const r = sug("Colixa", { tipos: ["estado", "municipio"] });
    expect(r.estado).toBe("ninguno"); // sigue sin resolver; el usuario elige
    expect(sugerencias(r).map((c) => `${c.tipo}:${c.clave}`)).toEqual(["estado:06", "municipio:06:COLIMA", "municipio:30:COLIPA"]);
  });

  it("con estado dado la lista se acota: «Colixa» en Veracruz solo sugiere Colipa; en Colima solo Colima", () => {
    expect(claves(sug("Colixa", { estadoCve: "30", tipos: ["municipio"] }))).toEqual(["30:COLIPA"]);
    expect(claves(sug("Colixa", { estadoCve: "06", tipos: ["municipio"] }))).toEqual(["06:COLIMA"]);
  });

  it("los homónimos de Oaxaca conservan su #cve en la sugerencia", () => {
    const r = sug("San Juan Mixtepc", { estadoCve: "20", tipos: ["municipio"] });
    expect(claves(r)).toEqual(["20:SAN JUAN MIXTEPEC#208", "20:SAN JUAN MIXTEPEC#209"]);
  });
});

describe("sugerencias por tecleo — lo que NO debe sugerir", () => {
  it.each(["Narnia", "Gotham", "Springfield", "Bogotá", "Ciénaga", "Nueva Granada", "Atlantis", "Madrit"])(
    "«%s» no es un tecleo: cero sugerencias falsas",
    (t) => expect(sugerencias(sug(t, { tipos: ["estado", "municipio"] }))).toEqual([])
  );

  it("distancia 2 no se sugiere («Guadlajra» está a 2 de Guadalajara)", () => {
    expect(sugerencias(sug("Guadlajra", { estadoCve: "14", tipos: ["municipio"] }))).toEqual([]);
  });

  it(`menos de ${MIN_LETRAS_SUGERENCIA} letras no activa la búsqueda («Lon», «Tula» mal tecleado)`, () => {
    expect(sugerencias(sug("Lon", { estadoCve: "11", tipos: ["municipio"] }))).toEqual([]);
    expect(sugerencias(sug("Tul", { estadoCve: "13", tipos: ["municipio"] }))).toEqual([]);
  });

  it("las coincidencias reales NO pasan por aquí: exacta, alias y parcial siguen igual, sin campo sugerencias", () => {
    for (const [t, opts] of [
      ["Comala", { estadoCve: "06" }],
      ["Mazatlán", {}],
      ["Tlaquepaque", { estadoCve: "14" }],
      ["Pachuca", { estadoCve: "13" }],
      ["Guadalajara", { estadoCve: "14" }],
    ] as const) {
      const r = sug(t, { ...opts, tipos: ["municipio"] });
      expect(r.estado).not.toBe("ninguno");
      expect(r).not.toHaveProperty("sugerencias");
    }
  });

  it("distritos y cabeceras no se sugieren; «Distrito Federal» a secas y «Nacional» tampoco", () => {
    expect(sugerencias(sug("distrito federal 99 de Jalisco"))).toEqual([]);
    expect(sugerencias(sug("Nacional"))).toEqual([]);
    expect(sugerencias(sug("D.L. 27 CDMX", { tipos: ["distrito_local"] }))).toEqual([]);
  });

  it("sin estado y con MÁS de 3 coincidencias no se sugiere nada; con estado dado sí (5 «Juárez» en el país)", () => {
    // «Juarex» está a 1 de JUAREZ, que existe en 5 estados: 5 candidatos > MAX_SUGERENCIAS → ninguna.
    const nacional = sug("Juarex", { tipos: ["municipio"] });
    expect(nacional).toEqual({ estado: "ninguno" });
    expect(claves(sug("Juarex", { estadoCve: "08", tipos: ["municipio"] }))).toEqual(["08:JUAREZ"]);
    expect(MAX_SUGERENCIAS).toBe(3);
  });
});

describe("regresión: con `sugerir` apagado (default) nada cambia", () => {
  it("«Guadalajra» sigue siendo `ninguno` exactamente igual, sin campo sugerencias", () => {
    const r = desambiguarReferencia("Guadalajra", { estadoCve: "14", municipios: MUN, tipos: ["municipio"] });
    expect(r).toEqual({ estado: "ninguno" });
  });
});
