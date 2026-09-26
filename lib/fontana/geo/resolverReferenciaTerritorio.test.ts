// lib/fontana/geo/resolverReferenciaTerritorio.test.ts
// Paso 3 (26-09-25): las herramientas de Fontana resuelven territorios con el núcleo de
// desambiguación. Casos reales acumulados en la ronda, con el catálogo real de 2,477 municipios
// (fixture) y los catálogos reales de cabeceras de distrito.

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";
import { nombreEstadoDisplay } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";

vi.mock("@/lib/geo/municipios", () => ({ getMunicipiosOptionsNacional: vi.fn() }));

import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { resolverReferenciaTerritorio, type ResolucionTerritorio } from "./resolverReferenciaTerritorio";

const CVE_PARES: Record<string, [string, string]> = {
  "20:SAN JUAN MIXTEPEC": ["208", "209"],
  "20:SAN PEDRO MIXTEPEC": ["316", "317"],
};

beforeEach(() => {
  const contador: Record<string, number> = {};
  vi.mocked(getMunicipiosOptionsNacional).mockResolvedValue(
    (catalogo as { estadoCve: string; nombre: string }[]).map((m) => {
      const k = `${m.estadoCve}:${m.nombre}`;
      const par = CVE_PARES[k];
      let cve = "000";
      if (par) {
        contador[k] = (contador[k] ?? 0) + 1;
        cve = par[contador[k] - 1];
      }
      return { ...m, cve, estadoNombre: nombreEstadoDisplay(m.estadoCve) ?? m.estadoCve } as never;
    })
  );
});

type Nivel = "nacional" | "estatal" | "distrital" | "municipal";
const registro = (viables: Partial<Record<Nivel, "confirmado" | "no_viable" | "pendiente">>) => ({
  niveles: (["nacional", "estatal", "distrital", "municipal"] as Nivel[]).map((nivel) => ({
    nivel,
    estado: viables[nivel] ?? "no_viable",
  })),
}) as never;

// F1-1 (población): admite todos los niveles. F3-4 (ENSU): solo municipal.
const AMBOS = registro({ nacional: "confirmado", estatal: "confirmado", distrital: "confirmado", municipal: "confirmado" });
const SOLO_MUNICIPAL = registro({ municipal: "confirmado" });
const SIN_DISTRITAL = registro({ nacional: "confirmado", estatal: "confirmado", municipal: "confirmado" });

const ok = (r: ResolucionTerritorio) => {
  if (!r.ok) throw new Error(`esperaba ok, vino ${r.referencia}`);
  return r;
};
const activo = (nivel: Territorio["nivel"], extra: Partial<Territorio> = {}): Territorio => ({ nivel, nombre: "activo", ...extra });

describe("nombres de municipio (reglas del núcleo)", () => {
  it("«Pachuca» → Pachuca de Soto (parcial único), con aviso de interpretación", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Pachuca", registro: SOLO_MUNICIPAL }));
    expect(r.territorio).toMatchObject({ nivel: "municipal", estado: "Hidalgo", municipio: "PACHUCA DE SOTO" });
    expect(r.aviso).toContain("se interpretó como");
  });

  it("«Neza» y «Ciudad Juárez» resuelven solos por alias coloquial", async () => {
    expect(ok(await resolverReferenciaTerritorio({ texto: "Neza", registro: SOLO_MUNICIPAL })).territorio).toMatchObject({ estado: "Estado de México", municipio: "NEZAHUALCOYOTL" });
    expect(ok(await resolverReferenciaTerritorio({ texto: "Ciudad Juárez", registro: SOLO_MUNICIPAL })).territorio).toMatchObject({ estado: "Chihuahua", municipio: "JUAREZ" });
  });

  it("«Ixtlahuacán» en Jalisco: ambiguo (de los Membrillos / del Río), con claves estables", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "Ixtlahuacán", estadoHint: "Jalisco", registro: SOLO_MUNICIPAL });
    expect(r).toMatchObject({ ok: false, referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") {
      expect(r.candidatos.map((c) => c.clave).sort()).toEqual(["14:IXTLAHUACAN DE LOS MEMBRILLOS", "14:IXTLAHUACAN DEL RIO"]);
    }
  });

  it("«Cuauhtémoc» y «Guadalupe»: varios exactos → solo ellos", async () => {
    const c = await resolverReferenciaTerritorio({ texto: "Cuauhtémoc", registro: SOLO_MUNICIPAL });
    expect(c).toMatchObject({ referencia: "ambiguo" });
    if (c.ok === false && c.referencia === "ambiguo") expect(c.candidatos).toHaveLength(4);
    const g = await resolverReferenciaTerritorio({ texto: "Guadalupe", registro: SOLO_MUNICIPAL });
    expect(g).toMatchObject({ referencia: "ambiguo" });
  });

  it("«Santiago»: un exacto + decenas de parciales → demasiados (pide el estado), con la exacta aparte", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "Santiago", registro: SOLO_MUNICIPAL });
    expect(r).toMatchObject({ ok: false, referencia: "demasiados" });
    if (r.ok === false && r.referencia === "demasiados") {
      expect(r.total).toBeGreaterThan(8);
      expect(r.exactas.map((c) => c.etiqueta)).toContain("Santiago, Nuevo León");
    }
  });

  it("los dos «San Juan Mixtepec» de Oaxaca se distinguen por su clave", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "San Juan Mixtepec", estadoHint: "Oaxaca", registro: SOLO_MUNICIPAL });
    expect(r).toMatchObject({ referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") {
      expect(r.candidatos.map((c) => c.clave).sort()).toEqual(["20:SAN JUAN MIXTEPEC#208", "20:SAN JUAN MIXTEPEC#209"]);
    }
  });
});

describe("estado vs municipio homónimo, según lo que el indicador admite", () => {
  it("Colima con un indicador de AMBOS niveles (F1-1): pregunta estado o municipio", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "Colima", registro: AMBOS });
    expect(r).toMatchObject({ ok: false, referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") expect(r.candidatos.map((c) => c.tipo).sort()).toEqual(["estado", "municipio"]);
  });

  it("Querétaro y Puebla con un indicador solo municipal (F3-4): el municipio, sin preguntar", async () => {
    for (const nombre of ["Querétaro", "Puebla"]) {
      const r = ok(await resolverReferenciaTerritorio({ texto: nombre, registro: SOLO_MUNICIPAL }));
      expect(r.territorio.nivel, nombre).toBe("municipal");
    }
  });

  it("el nivel explícito del usuario siempre gana", async () => {
    expect(ok(await resolverReferenciaTerritorio({ texto: "Colima", nivelHint: "estatal", registro: AMBOS })).territorio.nivel).toBe("estatal");
    expect(ok(await resolverReferenciaTerritorio({ texto: "Colima", tipoTerritorio: "municipio", registro: AMBOS })).territorio.nivel).toBe("municipal");
  });

  it("un estado cuyo nombre aparece DENTRO de otro municipio («Jalisco» / Ojuelos de Jalisco) es el estado, sin preguntar", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Jalisco", registro: AMBOS }));
    expect(r.territorio).toMatchObject({ nivel: "estatal", estado: "Jalisco" });
  });

  it("un nombre que solo es estado, pedido como municipal, cae al estado (compatibilidad)", async () => {
    expect(ok(await resolverReferenciaTerritorio({ texto: "Baja California", nivelHint: "municipal", registro: AMBOS })).territorio.nivel).toBe("estatal");
  });
});

describe("«México»: país o Estado de México", () => {
  it("con un indicador nacional + estatal, PREGUNTA (las dos salidas)", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "México", registro: AMBOS });
    expect(r).toMatchObject({ ok: false, referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") expect(r.candidatos.map((c) => c.clave).sort()).toEqual(["15", "MEX"]);
  });

  it("elegido «país» → Territorio nacional; elegido «estado» → Estado de México", async () => {
    const pais = ok(await resolverReferenciaTerritorio({ texto: "México", claveTerritorio: "MEX", registro: AMBOS }));
    expect(pais.territorio).toMatchObject({ nivel: "nacional", pais: "México" });
    const estado = ok(await resolverReferenciaTerritorio({ texto: "México", claveTerritorio: "15", registro: AMBOS }));
    expect(estado.territorio).toMatchObject({ nivel: "estatal", estado: "Estado de México" });
  });

  it("si el indicador no tiene nivel nacional, «México» solo puede ser el estado", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "México", registro: registro({ estatal: "confirmado", municipal: "confirmado" }) }));
    expect(r.territorio).toMatchObject({ nivel: "estatal", estado: "Estado de México" });
  });
});

describe("distritos: solo bajo demanda, forma canónica, indicador con nivel distrital", () => {
  it("«Iztapalapa» a secas es el municipio (los distritos no entran si no se piden)", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Iztapalapa", registro: AMBOS }));
    expect(r.territorio.nivel).toBe("municipal");
  });

  it("«distrito federal 5 de Jalisco» → D.F. 1405 PUERTO VALLARTA, con el Territorio completo", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "distrito federal 5 de Jalisco", registro: AMBOS }));
    expect(r.territorio).toMatchObject({
      nivel: "distrito_federal",
      estado: "Jalisco",
      nombre: "D.F. 1405 PUERTO VALLARTA",
      cve_distrito: "005",
      distritosSeleccionados: [{ cve: "005", nombre: "PUERTO VALLARTA", estado: "Jalisco" }],
    });
    expect(r.label).toBe("D.F. 1405 PUERTO VALLARTA (Jalisco)");
  });

  it("«D.L. 27 CDMX» → D.L. 0927 IZTAPALAPA", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "D.L. 27 CDMX", registro: AMBOS }));
    expect(r.territorio).toMatchObject({ nivel: "distrito_local", nombre: "D.L. 0927 IZTAPALAPA", cve_distrito: "027" });
  });

  it("«1405»: federal y local comparten código → pregunta con el prefijo", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "1405", registro: AMBOS });
    expect(r).toMatchObject({ ok: false, referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") {
      expect(r.candidatos.map((c) => c.etiqueta)).toEqual(["D.F. 1405 PUERTO VALLARTA (Jalisco)", "D.L. 1405 PUERTO VALLARTA (Jalisco)"]);
    }
  });

  it("Mérida ×3 (federal, Yucatán): tres opciones con su prefijo y su clave", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "distrito federal Mérida", estadoHint: "Yucatán", registro: AMBOS });
    expect(r).toMatchObject({ ok: false, referencia: "ambiguo" });
    if (r.ok === false && r.referencia === "ambiguo") {
      expect(r.candidatos.map((c) => c.clave)).toEqual(["3103", "3104", "3106"]);
      expect(r.candidatos.every((c) => c.etiqueta.startsWith("D.F. "))).toBe(true);
    }
  });

  it("un indicador sin nivel distrital lo dice, no sustituye por el municipio", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "distrito federal 5 de Jalisco", registro: SIN_DISTRITAL });
    expect(r).toMatchObject({ ok: false, referencia: "nivel_no_disponible" });
  });

  it("«Distrito Federal» a secas es la Ciudad de México (estado), nunca un distrito", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Distrito Federal", registro: AMBOS }));
    expect(r.territorio).toMatchObject({ nivel: "estatal", estado: "Ciudad de México" });
  });
});

describe("referencias contextuales: «este distrito» apunta al territorio activo", () => {
  const dto = activo("distrito_federal", { estado: "Jalisco", nombre: "D.F. 1405 PUERTO VALLARTA", cve_distrito: "005" });

  it("«este distrito», «mi distrito», «este distrito federal» → el territorio del proyecto, sin catálogo", async () => {
    for (const texto of ["este distrito", "mi distrito", "este distrito federal"]) {
      const r = ok(await resolverReferenciaTerritorio({ texto, registro: AMBOS, territorioActivo: dto }));
      expect(r.territorio, texto).toBe(dto);
      expect(r.via).toBe("contexto");
      expect(r.esTerritorioDelProyecto).toBe(true);
    }
  });

  it("pedir el nivel estatal desde un distrito: responde directo con el estado, sin preguntar", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "nivel estatal", registro: AMBOS, territorioActivo: dto }));
    expect(r.territorio).toMatchObject({ nivel: "estatal", estado: "Jalisco" });
    expect(r.via).toBe("contenedor");
    expect(r.aviso).toContain("todo Jalisco");
  });

  it("pedir el nivel nacional: derivado, con el aviso de que no es un promedio del territorio", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "nivel nacional", registro: AMBOS, territorioActivo: dto }));
    expect(r.territorio).toMatchObject({ nivel: "nacional" });
  });

  it("pedir el OTRO tipo de distrito: rechazo honesto (no existe la equivalencia)", async () => {
    const local = activo("distrito_local", { estado: "Jalisco", nombre: "D.L. 1405 PUERTO VALLARTA" });
    const r = await resolverReferenciaTerritorio({ texto: "este distrito federal", registro: AMBOS, territorioActivo: local });
    expect(r).toMatchObject({ ok: false, referencia: "hermano" });
    if (r.ok === false && r.referencia === "hermano") expect(r.mensaje).toContain("no tiene la equivalencia");
  });

  it("«este distrito» en un proyecto municipal no tiene referente", async () => {
    const r = await resolverReferenciaTerritorio({ texto: "este distrito", registro: AMBOS, territorioActivo: activo("municipal", { estado: "Jalisco", municipio: "Zapopan" }) });
    expect(r).toMatchObject({ ok: false, referencia: "sin_referente" });
  });

  it("«Distrito Federal» a secas NO se toma como contexto en un proyecto que no es distrital", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Distrito Federal", registro: AMBOS, territorioActivo: activo("municipal", { estado: "Jalisco" }) }));
    expect(r.via).toBe("nombre");
    expect(r.territorio).toMatchObject({ estado: "Ciudad de México" });
  });

  it("un nombre propio NUNCA se lee como contexto, aunque el proyecto sea distrital", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Guadalajara", nivelHint: "municipal", registro: SOLO_MUNICIPAL, territorioActivo: dto }));
    expect(r.via).toBe("nombre");
    expect(r.territorio).toMatchObject({ municipio: "GUADALAJARA" });
  });
});

describe("elección por clave: el servidor la verifica", () => {
  it("una clave válida entre los candidatos reales resuelve", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "Cuauhtémoc", claveTerritorio: "09:CUAUHTEMOC", registro: SOLO_MUNICIPAL }));
    expect(r.via).toBe("clave");
    expect(r.territorio).toMatchObject({ estado: "Ciudad de México", municipio: "CUAUHTEMOC" });
  });

  it("la clave de un par homónimo de Oaxaca elige el municipio correcto", async () => {
    const r = ok(await resolverReferenciaTerritorio({ texto: "San Juan Mixtepec", estadoHint: "Oaxaca", claveTerritorio: "20:SAN JUAN MIXTEPEC#209", registro: SOLO_MUNICIPAL }));
    expect(r.territorio).toMatchObject({ estado: "Oaxaca", municipio: "SAN JUAN MIXTEPEC" });
  });

  it("una clave inventada se rechaza", async () => {
    expect(await resolverReferenciaTerritorio({ texto: "Cuauhtémoc", claveTerritorio: "99:INVENTADO", registro: SOLO_MUNICIPAL })).toMatchObject({ ok: false, referencia: "clave_invalida" });
  });

  it("una clave AJENA (de otro nombre) se rechaza: el modelo no puede cambiar de territorio", async () => {
    expect(await resolverReferenciaTerritorio({ texto: "Cuauhtémoc", claveTerritorio: "14:GUADALAJARA", registro: SOLO_MUNICIPAL })).toMatchObject({ ok: false, referencia: "clave_invalida" });
  });

  it("la clave de un distrito se acepta solo entre los candidatos de ese texto", async () => {
    const buena = ok(await resolverReferenciaTerritorio({ texto: "1405", claveTerritorio: "1405", tipoTerritorio: "distrito_local", registro: AMBOS }));
    expect(buena.territorio).toMatchObject({ nivel: "distrito_local", nombre: "D.L. 1405 PUERTO VALLARTA" });
    expect(await resolverReferenciaTerritorio({ texto: "1405", claveTerritorio: "0927", registro: AMBOS })).toMatchObject({ ok: false, referencia: "clave_invalida" });
  });
});

describe("no reconocido", () => {
  it("un nombre que no existe → noResuelto", async () => {
    expect(await resolverReferenciaTerritorio({ texto: "Narnia", registro: AMBOS })).toMatchObject({ ok: false, referencia: "noResuelto" });
  });
});
