import { describe, expect, it } from "vitest";
import catalogo from "./__fixtures__/municipios_catalogo.json";
import { clavesDeMunicipiosDelEstado } from "./clavesMunicipioCatalogo";
import { desambiguarReferencia, type MunicipioCatalogoRef } from "./desambiguar";

// La fixture no trae `cve`; se asigna el cve INE de los 4 homónimos de Oaxaca y un cve secuencial al resto,
// como lo sirve /api/geo/options (por estado, ordenado por cve).
const CVE_PARES: Record<string, [string, string]> = {
  "20:SAN JUAN MIXTEPEC": ["208", "209"],
  "20:SAN PEDRO MIXTEPEC": ["316", "317"],
};
const contador: Record<string, number> = {};
const CON_CVE: MunicipioCatalogoRef[] = (catalogo as MunicipioCatalogoRef[]).map((m, i) => {
  const k = `${m.estadoCve}:${m.nombre}`;
  const par = CVE_PARES[k];
  if (!par) return { ...m, cve: String(i + 1000) };
  contador[k] = (contador[k] ?? 0) + 1;
  return { ...m, cve: par[contador[k] - 1] };
});
const porEstado = (cve: string) => CON_CVE.filter((m) => m.estadoCve === cve).map((m) => ({ cve: m.cve as string, nombre: m.nombre }));

describe("clavesDeMunicipiosDelEstado", () => {
  it("Oaxaca (570): claves únicas y SOLO los 4 homónimos llevan #cve", () => {
    const filas = porEstado("20");
    expect(filas).toHaveLength(570);
    const claves = clavesDeMunicipiosDelEstado("20", filas);
    expect(new Set(claves).size).toBe(570);
    expect(claves.filter((c) => c.includes("#")).sort()).toEqual([
      "20:SAN JUAN MIXTEPEC#208",
      "20:SAN JUAN MIXTEPEC#209",
      "20:SAN PEDRO MIXTEPEC#316",
      "20:SAN PEDRO MIXTEPEC#317",
    ]);
  });

  it("los 32 estados: ninguna clave repetida y ningún sufijo fuera de Oaxaca", () => {
    let conSufijo = 0;
    for (let e = 1; e <= 32; e++) {
      const cve = String(e).padStart(2, "0");
      const claves = clavesDeMunicipiosDelEstado(cve, porEstado(cve));
      expect(new Set(claves).size).toBe(claves.length);
      const sufijos = claves.filter((c) => c.includes("#"));
      conSufijo += sufijos.length;
      if (cve !== "20") expect(sufijos).toEqual([]);
    }
    expect(conSufijo).toBe(4);
  });

  it("coincide con las claves que produce desambiguarReferencia (misma regla, dos caminos)", () => {
    const claves = clavesDeMunicipiosDelEstado("20", porEstado("20"));
    for (const nombre of ["San Juan Mixtepec", "San Pedro Mixtepec"]) {
      const r = desambiguarReferencia(nombre, { estadoCve: "20", municipios: CON_CVE, tipos: ["municipio"] });
      if (r.estado !== "ambiguo") throw new Error("se esperaba ambiguo");
      for (const c of r.candidatos) expect(claves).toContain(c.clave);
    }
    // y una clave normal (Guadalajara, Jalisco) sin sufijo
    expect(clavesDeMunicipiosDelEstado("14", porEstado("14"))).toContain("14:GUADALAJARA");
  });
});
