// lib/geo/display.test.ts
// Convención de display (decisión de producto 26-09-19): distrito = prefijo +
// cabecera en MAYÚSCULAS sin acentos (Ñ/Ü conservadas); estado/municipio =
// sin prefijo, capitalización normal, con acentos. Las dos formas NO se mezclan.

import { describe, expect, it } from "vitest";
import { nombreDistritoDisplay, nombreMunicipioDisplay } from "./display";
import { nombreEstadoDisplay } from "./estados";
import { normalizeGeoName } from "./municipioCanonico";

describe("distrito electoral: prefijo + MAYÚSCULAS sin acento", () => {
  it("'1405 PUERTO VALLARTA' (formato actual de Sefix, sin cambios)", () => {
    expect(nombreDistritoDisplay("14", "5", "Puerto Vallarta")).toBe("1405 PUERTO VALLARTA");
    expect(nombreDistritoDisplay("14", "05", "PUERTO VALLARTA")).toBe("1405 PUERTO VALLARTA");
  });

  it("los 3 distritos de Yucatán que comparten cabecera se distinguen por el prefijo", () => {
    const nombres = [3, 4, 6].map((n) => nombreDistritoDisplay("31", n, "Mérida"));
    expect(nombres).toEqual(["3103 MERIDA", "3104 MERIDA", "3106 MERIDA"]);
    expect(new Set(nombres).size).toBe(3);
  });

  it("quita acentos pero conserva Ñ y Ü", () => {
    expect(nombreDistritoDisplay("14", 14, "Tlajomulco de Zúñiga")).toBe("1414 TLAJOMULCO DE ZUÑIGA");
    expect(nombreDistritoDisplay("28", 1, "Güémez")).toBe("2801 GÜEMEZ");
  });
});

describe("municipio/ciudad: sin prefijo, capitalización normal", () => {
  it("'Puerto Vallarta' — el mismo lugar que el distrito 1405, SIN prefijo", () => {
    const m = nombreMunicipioDisplay("PUERTO VALLARTA");
    expect(m.nombre).toBe("Puerto Vallarta");
    expect(m.nombre).not.toMatch(/^\d/);
  });

  it("si el nombre YA trae acentos se conservan ('Mérida', 'Tlajomulco de Zúñiga')", () => {
    expect(nombreMunicipioDisplay("Mérida")).toEqual({ nombre: "Mérida", conAcentosGarantizados: true });
    expect(nombreMunicipioDisplay("Tlajomulco de Zúñiga").nombre).toBe("Tlajomulco de Zúñiga");
  });

  it("desde un catálogo en MAYÚSCULAS sin acentos NO inventa acentos y lo declara", () => {
    const r = nombreMunicipioDisplay("MERIDA");
    expect(r.nombre).toBe("Merida");
    expect(r.conAcentosGarantizados).toBe(false);
  });

  it("partículas en minúscula ('San Pedro Tlaquepaque', 'Tlajomulco de Zuñiga')", () => {
    expect(nombreMunicipioDisplay("TLAJOMULCO DE ZUÑIGA").nombre).toBe("Tlajomulco de Zuñiga");
    expect(nombreMunicipioDisplay("SAN PEDRO TLAQUEPAQUE").nombre).toBe("San Pedro Tlaquepaque");
  });
});

describe("las dos representaciones no se mezclan", () => {
  it("el mismo lugar: distrito (prefijo, MAYÚSCULAS) ≠ municipio (sin prefijo, capitalización normal), pero misma clave interna", () => {
    const distrito = nombreDistritoDisplay("14", 5, "Puerto Vallarta");
    const municipio = nombreMunicipioDisplay("PUERTO VALLARTA").nombre;
    expect(distrito).toBe("1405 PUERTO VALLARTA");
    expect(municipio).toBe("Puerto Vallarta");
    expect(distrito).not.toBe(municipio);
    // La clave interna (para comparar) de la cabecera es la misma en ambos.
    expect(distrito.replace(/^\d+\s/, "")).toBe(normalizeGeoName(municipio));
  });

  it("estado: nombre a mostrar corto con acentos, distinto de la clave interna", () => {
    expect(nombreEstadoDisplay("16")).toBe("Michoacán");
    expect(normalizeGeoName(nombreEstadoDisplay("16")!)).toBe("MICHOACAN");
  });
});
