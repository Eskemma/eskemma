import { describe, expect, it } from "vitest";
import type { MunicipioSeleccionado } from "@/types/shared.types";
import { aplicarSeleccionMunicipios, clavesSeleccionadas, opcionesMunicipios, type MunicipioCatalogo } from "./municipiosMultiselect";

const JAL: MunicipioCatalogo[] = [
  { cve: "039", nombre: "GUADALAJARA", clave: "14:GUADALAJARA" },
  { cve: "120", nombre: "ZAPOPAN", clave: "14:ZAPOPAN" },
  { cve: "098", nombre: "SAN PEDRO TLAQUEPAQUE", clave: "14:SAN PEDRO TLAQUEPAQUE" },
];
const OAX: MunicipioCatalogo[] = [
  { cve: "207", nombre: "SAN JUAN MITLA", clave: "20:SAN JUAN MITLA" },
  { cve: "208", nombre: "SAN JUAN MIXTEPEC", clave: "20:SAN JUAN MIXTEPEC#208" },
  { cve: "209", nombre: "SAN JUAN MIXTEPEC", clave: "20:SAN JUAN MIXTEPEC#209" },
  { cve: "316", nombre: "SAN PEDRO MIXTEPEC", clave: "20:SAN PEDRO MIXTEPEC#316" },
  { cve: "317", nombre: "SAN PEDRO MIXTEPEC", clave: "20:SAN PEDRO MIXTEPEC#317" },
];

describe("opcionesMunicipios", () => {
  it("una opción por clave, con nombre de display; los homónimos de Oaxaca se distinguen por su Dto.", () => {
    const o = opcionesMunicipios("20", OAX, []);
    expect(o).toHaveLength(5);
    expect(o.map((x) => x.value)).toContain("20:SAN JUAN MIXTEPEC#208");
    expect(o.find((x) => x.value === "20:SAN JUAN MIXTEPEC#208")?.label).toBe("San Juan Mixtepec (Dto. 08)");
    expect(o.find((x) => x.value === "20:SAN JUAN MIXTEPEC#209")?.label).toBe("San Juan Mixtepec (Dto. 26)");
    expect(o.find((x) => x.value === "20:SAN JUAN MITLA")?.label).toBe("San Juan Mitla");
  });

  it("incluye seleccionados con clave que el catálogo no trae (p. ej. mientras carga) y omite los sin clave", () => {
    const sel: MunicipioSeleccionado[] = [
      { nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" },
      { nombre: "Nuevo Mun", estado: "Jalisco", clave: "14:NUEVO MUN" },
      { nombre: "Escrito a mano", estado: "Jalisco" },
    ];
    const o = opcionesMunicipios("14", JAL, sel);
    expect(o.map((x) => x.value)).toEqual(["14:GUADALAJARA", "14:ZAPOPAN", "14:SAN PEDRO TLAQUEPAQUE", "14:NUEVO MUN"]);
  });
});

describe("aplicarSeleccionMunicipios", () => {
  it("Guadalajara + Zapopan + Tlaquepaque: se agregan con nombre oficial y clave, sin duplicar", () => {
    let m: MunicipioSeleccionado[] = [];
    m = aplicarSeleccionMunicipios(m, "Jalisco", ["14:GUADALAJARA"], JAL);
    m = aplicarSeleccionMunicipios(m, "Jalisco", ["14:GUADALAJARA", "14:ZAPOPAN", "14:SAN PEDRO TLAQUEPAQUE"], JAL);
    m = aplicarSeleccionMunicipios(m, "Jalisco", ["14:GUADALAJARA", "14:ZAPOPAN", "14:SAN PEDRO TLAQUEPAQUE"], JAL);
    expect(m).toEqual([
      { nombre: "Guadalajara", estado: "Jalisco", clave: "14:GUADALAJARA" },
      { nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" },
      { nombre: "San Pedro Tlaquepaque", estado: "Jalisco", clave: "14:SAN PEDRO TLAQUEPAQUE" },
    ]);
  });

  it("homónimos de Oaxaca: los dos San Juan Mixtepec son entradas distintas y quitar uno conserva el otro", () => {
    let m = aplicarSeleccionMunicipios([], "Oaxaca", ["20:SAN JUAN MIXTEPEC#208", "20:SAN JUAN MIXTEPEC#209"], OAX);
    expect(m).toHaveLength(2);
    expect(clavesSeleccionadas(m, "Oaxaca")).toEqual(["20:SAN JUAN MIXTEPEC#208", "20:SAN JUAN MIXTEPEC#209"]);
    m = aplicarSeleccionMunicipios(m, "Oaxaca", ["20:SAN JUAN MIXTEPEC#209"], OAX);
    expect(clavesSeleccionadas(m, "Oaxaca")).toEqual(["20:SAN JUAN MIXTEPEC#209"]);
  });

  it("no toca otros estados ni las entradas SIN clave (alta libre / fuera de México)", () => {
    const base: MunicipioSeleccionado[] = [
      { nombre: "Nueva Granada", estado: "Magdalena" },
      { nombre: "Colima", estado: "Colima", clave: "06:COLIMA" },
      { nombre: "Escrito a mano", estado: "Jalisco" },
    ];
    const m = aplicarSeleccionMunicipios(base, "Jalisco", ["14:ZAPOPAN"], JAL);
    expect(m).toContainEqual({ nombre: "Nueva Granada", estado: "Magdalena" });
    expect(m).toContainEqual({ nombre: "Colima", estado: "Colima", clave: "06:COLIMA" });
    expect(m).toContainEqual({ nombre: "Escrito a mano", estado: "Jalisco" });
    expect(m).toContainEqual({ nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" });
    // vaciar la selección de Jalisco quita solo lo que tiene clave de Jalisco
    const vacio = aplicarSeleccionMunicipios(m, "Jalisco", [], JAL);
    expect(vacio).toEqual(base);
  });

  it("elegir en el picker un municipio ya escrito a mano (sin clave) lo completa, no lo duplica", () => {
    const base: MunicipioSeleccionado[] = [{ nombre: "Zapopan", estado: "Jalisco" }];
    const m = aplicarSeleccionMunicipios(base, "Jalisco", ["14:ZAPOPAN"], JAL);
    expect(m).toEqual([{ nombre: "Zapopan", estado: "Jalisco", clave: "14:ZAPOPAN" }]);
  });

  it("una clave que no está en el catálogo se ignora (nunca se fabrica una entrada)", () => {
    expect(aplicarSeleccionMunicipios([], "Jalisco", ["14:NO EXISTE"], JAL)).toEqual([]);
  });
});
