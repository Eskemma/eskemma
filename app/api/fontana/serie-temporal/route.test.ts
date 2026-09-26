// app/api/fontana/serie-temporal/route.test.ts
// Paso 3 (26-09-25): cableado del núcleo en la ruta de series. Los resolvers de datos se mockean.

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";
import { nombreEstadoDisplay } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/fontana/sesionTerritorio", () => ({ cargarSesionConTerritorioActual: vi.fn() }));
vi.mock("@/lib/fontana/indicatorRegistry", () => ({ getIndicadorRegistro: vi.fn() }));
vi.mock("@/lib/fontana/ingesta/serieTemporal", () => ({ resolverSerieTemporal: vi.fn() }));
vi.mock("@/lib/geo/municipios", async () => ({
  ...(await import("@/lib/geo/municipioCanonico")),
  getMunicipiosOptionsNacional: vi.fn(),
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverSerieTemporal } from "@/lib/fontana/ingesta/serieTemporal";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { GET } from "./route";

const niveles = (estados: Record<string, string>) =>
  ["nacional", "estatal", "distrital", "municipal"].map((nivel) => ({ nivel, estado: estados[nivel] ?? "no_viable" }));
const registro = (id: string, e: Record<string, string>) => ({ id, nombre: `Indicador ${id}`, niveles: niveles(e), disponibilidadTemporal: null });

const serieOk = (nivel: string, territorioLabel: string) => ({
  ok: true, nivel, territorioLabel, formato: "coeficiente", unidad: null, naturaleza: null, fuenteEtiqueta: "Fuente de prueba",
  puntos: [{ periodo: "2022", valor: 0.4 }, { periodo: "2024", valor: 0.5 }],
});

function activo(nivel: Territorio["nivel"], extra: Partial<Territorio> = {}): Territorio {
  return { nivel, nombre: "activo", ...extra };
}
function pedir(indicadorId: string, query: Record<string, string>) {
  const params = new URLSearchParams({ sesionId: "s1", indicadorId, ...query });
  return GET(new Request(`http://localhost/api/fontana/serie-temporal?${params}`) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getMunicipiosOptionsNacional).mockResolvedValue(
    (catalogo as { estadoCve: string; nombre: string }[]).map((m) => ({ ...m, cve: "000", estadoNombre: nombreEstadoDisplay(m.estadoCve) })) as never
  );
  vi.mocked(getIndicadorRegistro).mockImplementation(async (id: string) =>
    (id === "F2-5" ? registro(id, { municipal: "confirmado" }) : registro(id, { nacional: "confirmado", estatal: "confirmado" })) as never
  );
  vi.mocked(cargarSesionConTerritorioActual).mockResolvedValue({
    sesion: { territorio: activo("distrito_local", { estado: "Ciudad de México", nombre: "D.L. 0927 IZTAPALAPA", distritosSeleccionados: [{ cve: "027", nombre: "IZTAPALAPA", estado: "Ciudad de México" }] }) },
    ref: {},
  } as never);
  vi.mocked(resolverSerieTemporal).mockImplementation(async (_id: string, t: Territorio) => serieOk(t.nivel === "nacional" ? "nacional" : t.nivel === "municipal" ? "municipal" : "estatal", t.nombre) as never);
});

describe("GET /api/fontana/serie-temporal (Paso 3)", () => {
  it("«este distrito» sigue por la rama del PROYECTO (mismo territorio, sin catálogo)", async () => {
    const j = await (await pedir("F2-6", { territorio: "este distrito" })).json();
    expect(j).toMatchObject({ ok: true, esTerritorioDelProyecto: true, esTerritorioExterno: false });
    expect(vi.mocked(resolverSerieTemporal).mock.calls[0][1]).toMatchObject({ nivel: "distrito_local" });
  });

  it("«México»: pregunta país o Estado de México; elegido el país, la serie es NACIONAL", async () => {
    const pregunta = await (await pedir("F2-6", { territorio: "México" })).json();
    expect(pregunta).toMatchObject({ ok: false, referencia: "ambiguo" });
    const j = await (await pedir("F2-6", { territorio: "México", clave: "MEX" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "nacional", territorio: { label: "México" }, esTerritorioExterno: true });
    expect(vi.mocked(resolverSerieTemporal).mock.calls[0][1]).toMatchObject({ nivel: "nacional" });
  });

  it("un estado nombrado (regresión): serie estatal del estado", async () => {
    const j = await (await pedir("F2-6", { territorio: "Jalisco" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "estatal", territorio: { label: "Jalisco" } });
  });

  it("un distrito nombrado: las series no se calculan por distrito, y se dice", async () => {
    const j = await (await pedir("F2-6", { territorio: "D.L. 27 CDMX", tipo: "distrito_local" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "nivel_no_disponible" });
    expect(resolverSerieTemporal).not.toHaveBeenCalled();
  });

  it("un municipio con un indicador sin serie municipal: colapsoNivel, como antes (regresión)", async () => {
    const j = await (await pedir("F2-6", { territorio: "Guadalajara", tipo: "municipio" })).json();
    expect(j).toMatchObject({ ok: false, colapsoNivel: true, pidioNivel: "municipal" });
  });

  it("un municipio con serie municipal (F2-5): serie municipal del municipio elegido por clave", async () => {
    const j = await (await pedir("F2-5", { territorio: "Cuauhtémoc", clave: "09:CUAUHTEMOC" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "municipal" });
    expect(vi.mocked(resolverSerieTemporal).mock.calls[0][1]).toMatchObject({ nivel: "municipal", estado: "Ciudad de México" });
  });

  it("un nombre ambiguo devuelve candidatos con clave y no llama al resolver de datos", async () => {
    const j = await (await pedir("F2-5", { territorio: "Cuauhtémoc" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "ambiguo" });
    expect(j.candidatos).toHaveLength(4);
    expect(resolverSerieTemporal).not.toHaveBeenCalled();
  });
});
