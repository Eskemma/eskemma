// app/api/fontana/comparacion-territorios/route.test.ts
// Paso 3 (26-09-25): cableado del lote con el núcleo. Regresión del incidente Querétaro/Puebla
// (indicador solo municipal → municipio) y los casos nuevos (distrito, país, contexto, ambiguo).

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";
import { nombreEstadoDisplay } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/fontana/sesionTerritorio", () => ({ cargarSesionConTerritorioActual: vi.fn() }));
vi.mock("@/lib/fontana/indicatorRegistry", () => ({ getIndicadorRegistro: vi.fn() }));
vi.mock("@/lib/fontana/ingesta", () => ({ resolverIndicadorFontana: vi.fn() }));
vi.mock("@/lib/fontana/ingesta/contenidoCurado", () => ({ esIndicadorNarrativoCurado: () => false }));
vi.mock("@/lib/geo/municipios", async () => ({
  ...(await import("@/lib/geo/municipioCanonico")),
  getMunicipiosOptionsNacional: vi.fn(),
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { GET } from "./route";

const niveles = (estados: Record<string, string>) =>
  ["nacional", "estatal", "distrital", "municipal"].map((nivel) => ({ nivel, estado: estados[nivel] ?? "no_viable" }));
const TODOS = { nacional: "confirmado", estatal: "confirmado", distrital: "confirmado", municipal: "confirmado" };

function pedir(indicadorId: string, filas: { territorio: string; estado?: string; clave?: string; tipo?: string }[]) {
  const params = new URLSearchParams({ sesionId: "s1", indicadorId });
  for (const f of filas) {
    params.append("territorio", f.territorio);
    params.append("estado", f.estado ?? "");
    params.append("clave", f.clave ?? "");
    params.append("tipo", f.tipo ?? "");
  }
  return GET(new Request(`http://localhost/api/fontana/comparacion-territorios?${params}`) as never);
}
const territorioActivo: Territorio = { nivel: "distrito_federal", nombre: "activo", estado: "Yucatán", distritosSeleccionados: [{ cve: "002", nombre: "PROGRESO", estado: "Yucatán" }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getIndicadorRegistro).mockResolvedValue({ id: "F1-1", nombre: "Población total", fuenteEtiqueta: "Fuente", niveles: niveles(TODOS) } as never);
  vi.mocked(getMunicipiosOptionsNacional).mockResolvedValue(
    (catalogo as { estadoCve: string; nombre: string }[]).map((m) => ({ ...m, cve: "000", estadoNombre: nombreEstadoDisplay(m.estadoCve) })) as never
  );
  vi.mocked(resolverIndicadorFontana).mockResolvedValue([
    { nivel: "nacional", valor: 1 }, { nivel: "estatal", valor: 2 }, { nivel: "distrital", valor: 3 }, { nivel: "municipal", valor: 4 },
  ] as never);
  vi.mocked(cargarSesionConTerritorioActual).mockResolvedValue({ sesion: { territorio: territorioActivo }, ref: {} } as never);
});

describe("GET /api/fontana/comparacion-territorios (Paso 3)", () => {
  it("regresión Querétaro/Puebla: con un indicador solo municipal se resuelven como MUNICIPIO, sin preguntar", async () => {
    vi.mocked(getIndicadorRegistro).mockResolvedValue({ id: "F3-4", nombre: "Percepción", fuenteEtiqueta: "F", niveles: niveles({ municipal: "confirmado" }) } as never);
    const j = await (await pedir("F3-4", [{ territorio: "Querétaro" }, { territorio: "Puebla" }, { territorio: "Cuernavaca" }])).json();
    expect(j.ok).toBe(true);
    expect(j.filas.map((f: { nivel: string }) => f.nivel)).toEqual(["municipal", "municipal", "municipal"]);
    expect(j.noResueltos).toEqual([]);
  });

  it("un ambiguo queda en noResueltos con sus opciones (etiqueta + clave); el resto se compara", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "Colima" }, { territorio: "Guadalajara" }])).json();
    expect(j.filas).toHaveLength(1);
    expect(j.noResueltos).toHaveLength(1);
    expect(j.noResueltos[0].opciones.map((o: { tipo: string }) => o.tipo).sort()).toEqual(["estado", "municipio"]);
  });

  it("con la clave elegida (paralela por posición) entra a la comparación", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "Colima", clave: "06", tipo: "estado" }, { territorio: "Guadalajara" }])).json();
    expect(j.filas.map((f: { nivel: string }) => f.nivel)).toEqual(["estatal", "municipal"]);
    expect(j.noResueltos).toEqual([]);
  });

  it("un distrito entra con su celda DISTRITAL y la etiqueta canónica; el país con la NACIONAL", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "D.F. 3102" }, { territorio: "México", clave: "MEX" }])).json();
    expect(j.filas[0]).toMatchObject({ territorioLabel: "D.F. 3102 PROGRESO (Yucatán)", nivel: "distrital", valor: 3 });
    expect(j.filas[1]).toMatchObject({ nivel: "nacional", valor: 1 });
  });

  it("«este distrito» en la lista es el territorio del proyecto (marcado como tal)", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "este distrito" }, { territorio: "Guadalajara" }])).json();
    expect(j.filas[0]).toMatchObject({ esTerritorioDelProyecto: true, esTerritorioExterno: false, nivel: "distrital" });
    expect(j.filas[1]).toMatchObject({ esTerritorioDelProyecto: false, esTerritorioExterno: true });
  });

  it("el otro tipo de distrito queda como no resuelto, con el motivo honesto", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "este distrito local" }, { territorio: "Guadalajara" }])).json();
    expect(j.filas).toHaveLength(1);
    expect(j.noResueltos[0].motivo).toContain("no tiene la equivalencia");
  });

  it("si ninguno se reconoce → ok:false con los motivos", async () => {
    const j = await (await pedir("F1-1", [{ territorio: "Narnia" }, { territorio: "Mordor" }])).json();
    expect(j).toMatchObject({ ok: false });
    expect(j.noResueltos).toHaveLength(2);
  });
});
