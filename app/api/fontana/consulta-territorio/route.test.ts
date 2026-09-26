// app/api/fontana/consulta-territorio/route.test.ts
// Paso 3 (26-09-25): la ruta resuelve el territorio con el núcleo. Se mockean la sesión, el registro
// del indicador, el catálogo de municipios y los resolvers de datos: aquí se prueba el CABLEADO
// (contexto, clave, distrito, país, nivel objetivo), no las fuentes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";
import { nombreEstadoDisplay } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/fontana/sesionTerritorio", () => ({ cargarSesionConTerritorioActual: vi.fn() }));
vi.mock("@/lib/fontana/indicatorRegistry", () => ({ getIndicadorRegistro: vi.fn() }));
vi.mock("@/lib/fontana/ingesta", () => ({ resolverIndicadorFontana: vi.fn() }));
vi.mock("@/lib/fontana/ingesta/contenidoCurado", () => ({ esIndicadorNarrativoCurado: () => false }));
vi.mock("@/lib/geo/municipios", () => ({ getMunicipiosOptionsNacional: vi.fn() }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverIndicadorFontana } from "@/lib/fontana/ingesta";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { GET } from "./route";

const niveles = (estados: Record<string, string>) =>
  ["nacional", "estatal", "distrital", "municipal"].map((nivel) => ({ nivel, estado: estados[nivel] ?? "no_viable" }));

const REGISTRO = { id: "F1-1", nombre: "Población total", definicion: null, niveles: niveles({ nacional: "confirmado", estatal: "confirmado", distrital: "confirmado", municipal: "confirmado" }) };

function activo(nivel: Territorio["nivel"], extra: Partial<Territorio> = {}): Territorio {
  return { nivel, nombre: "activo", ...extra };
}

function pedir(query: Record<string, string>) {
  const params = new URLSearchParams({ sesionId: "s1", indicadorId: "F1-1", ...query });
  return GET(new Request(`http://localhost/api/fontana/consulta-territorio?${params}`) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getIndicadorRegistro).mockResolvedValue(REGISTRO as never);
  vi.mocked(getMunicipiosOptionsNacional).mockResolvedValue(
    (catalogo as { estadoCve: string; nombre: string }[]).map((m) => ({ ...m, cve: "000", estadoNombre: nombreEstadoDisplay(m.estadoCve) })) as never
  );
  // Una celda por nivel, con un valor distinguible: nacional 1, estatal 2, distrital 3, municipal 4.
  vi.mocked(resolverIndicadorFontana).mockResolvedValue([
    { nivel: "nacional", valor: 1, unidad: "personas", fuenteEtiqueta: "INEGI (Censo 2020, vía ECEG)" },
    { nivel: "estatal", valor: 2, unidad: "personas", fuenteEtiqueta: "INEGI (Censo 2020, vía ECEG)" },
    { nivel: "distrital", valor: 3, unidad: "personas", fuenteEtiqueta: "INEGI (Censo 2020, vía ECEG)" },
    { nivel: "municipal", valor: 4, unidad: "personas", fuenteEtiqueta: "INEGI (Censo 2020, vía ECEG)" },
  ] as never);
  vi.mocked(cargarSesionConTerritorioActual).mockResolvedValue({
    sesion: { territorio: activo("distrito_federal", { estado: "Jalisco", nombre: "D.F. 1405 PUERTO VALLARTA", distritosSeleccionados: [{ cve: "005", nombre: "PUERTO VALLARTA", estado: "Jalisco" }] }) },
    ref: {},
  } as never);
});

describe("GET /api/fontana/consulta-territorio (Paso 3)", () => {
  it("un municipio nombrado: nivel municipal, mismo resultado de siempre", async () => {
    const j = await (await pedir({ territorio: "Guadalajara" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "municipal", valor: 4, territorio: { label: "GUADALAJARA, Jalisco", nivel: "municipal" } });
  });

  it("«Pachuca» se interpreta como Pachuca de Soto y la respuesta lo avisa", async () => {
    const j = await (await pedir({ territorio: "Pachuca" })).json();
    expect(j).toMatchObject({ ok: true, territorio: { label: "PACHUCA DE SOTO, Hidalgo" } });
    expect(j.aviso).toContain("se interpretó como");
  });

  it("un nombre ambiguo devuelve candidatos con clave, tipo y etiqueta (nunca elige)", async () => {
    const j = await (await pedir({ territorio: "Colima" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "ambiguo", ambiguo: true });
    expect(j.candidatos.map((c: { tipo: string }) => c.tipo).sort()).toEqual(["estado", "municipio"]);
    expect(j.candidatos[0]).toEqual(expect.objectContaining({ clave: expect.any(String), etiqueta: expect.any(String) }));
    expect(resolverIndicadorFontana).not.toHaveBeenCalled();
  });

  it("la clave elegida resuelve; una clave ajena se rechaza sin llamar al resolver de datos", async () => {
    const buena = await (await pedir({ territorio: "Colima", clave: "06", tipo: "estado" })).json();
    expect(buena).toMatchObject({ ok: true, nivel: "estatal", valor: 2 });
    vi.mocked(resolverIndicadorFontana).mockClear();
    const mala = await (await pedir({ territorio: "Colima", clave: "14:GUADALAJARA" })).json();
    expect(mala).toMatchObject({ ok: false, referencia: "clave_invalida" });
    expect(resolverIndicadorFontana).not.toHaveBeenCalled();
  });

  it("«México» pregunta; elegido el país, la celda es la NACIONAL", async () => {
    const pregunta = await (await pedir({ territorio: "México" })).json();
    expect(pregunta).toMatchObject({ ok: false, referencia: "ambiguo" });
    const pais = await (await pedir({ territorio: "México", clave: "MEX" })).json();
    expect(pais).toMatchObject({ ok: true, nivel: "nacional", valor: 1, territorio: { nivel: "nacional" } });
  });

  it("un distrito por número: la celda es la DISTRITAL y la etiqueta lleva prefijo, clave y estado", async () => {
    const j = await (await pedir({ territorio: "distrito federal 2 de Yucatán" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "distrital", valor: 3, territorio: { label: "D.F. 3102 PROGRESO (Yucatán)", nivel: "distrito_federal" } });
  });

  it("un distrito con un indicador sin nivel distrital: lo dice, no lo sustituye por otro nivel", async () => {
    vi.mocked(getIndicadorRegistro).mockResolvedValue({ ...REGISTRO, niveles: niveles({ estatal: "confirmado", municipal: "confirmado" }) } as never);
    const j = await (await pedir({ territorio: "distrito federal 2 de Yucatán" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "nivel_no_disponible" });
  });

  it("un distrito cuya celda distrital no tiene valor NO cae al valor de otro nivel", async () => {
    vi.mocked(resolverIndicadorFontana).mockResolvedValue([
      { nivel: "estatal", valor: 2, unidad: "personas" },
      { nivel: "distrital", motivo: "Sin datos suficientes para agregar este distrito" },
    ] as never);
    const j = await (await pedir({ territorio: "D.F. 3102" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "distrital", valor: null });
    expect(j.motivo).toContain("Sin datos suficientes");
  });

  it("«este distrito» es el territorio del proyecto: indica usar consultar_indicador", async () => {
    const j = await (await pedir({ territorio: "este distrito" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "territorio_del_proyecto", esTerritorioDelProyecto: true });
    expect(j.mensaje).toContain("consultar_indicador");
    expect(resolverIndicadorFontana).not.toHaveBeenCalled();
  });

  it("nivel estatal desde el distrito del proyecto: responde directo con el estado, avisando el alcance", async () => {
    const j = await (await pedir({ territorio: "nivel estatal" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "estatal", valor: 2, territorio: { label: "Jalisco" } });
    expect(j.aviso).toContain("todo Jalisco");
  });

  it("el OTRO tipo de distrito (el proyecto es federal, piden el local): rechazo honesto", async () => {
    const j = await (await pedir({ territorio: "este distrito local" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "hermano" });
    expect(j.mensaje).toContain("no tiene la equivalencia");
  });

  it("un nombre que no existe: noResuelto", async () => {
    expect(await (await pedir({ territorio: "Narnia" })).json()).toMatchObject({ ok: false, noResuelto: true });
  });

  it("sin sesión → 401; sesión ajena → 404", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await pedir({ territorio: "Guadalajara" })).status).toBe(401);
    vi.mocked(cargarSesionConTerritorioActual).mockResolvedValueOnce(null);
    expect((await pedir({ territorio: "Guadalajara" })).status).toBe(404);
  });
});
