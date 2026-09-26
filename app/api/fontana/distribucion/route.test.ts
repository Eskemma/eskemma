// app/api/fontana/distribucion/route.test.ts
// Paso 3 (26-09-25): cableado del núcleo en la ruta de distribución (pirámide / urbano-rural).

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";
import { nombreEstadoDisplay } from "@/lib/geo/estados";
import type { Territorio } from "@/types/shared.types";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/fontana/sesionTerritorio", () => ({ cargarSesionConTerritorioActual: vi.fn() }));
vi.mock("@/lib/fontana/indicatorRegistry", () => ({ getIndicadorRegistro: vi.fn() }));
vi.mock("@/lib/fontana/ingesta/iter", () => ({ resolverIndicadorIter: vi.fn() }));
vi.mock("@/lib/geo/municipios", async () => ({
  ...(await import("@/lib/geo/municipioCanonico")),
  getMunicipiosOptionsNacional: vi.fn(),
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { cargarSesionConTerritorioActual } from "@/lib/fontana/sesionTerritorio";
import { getIndicadorRegistro } from "@/lib/fontana/indicatorRegistry";
import { resolverIndicadorIter } from "@/lib/fontana/ingesta/iter";
import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { GET } from "./route";

const niveles = ["nacional", "estatal", "distrital", "municipal"].map((nivel) => ({
  nivel,
  estado: nivel === "distrital" ? "no_viable" : "confirmado",
}));
const territorioActivo: Territorio = { nivel: "distrito_local", nombre: "activo", estado: "Ciudad de México", distritosSeleccionados: [{ cve: "027", nombre: "IZTAPALAPA", estado: "Ciudad de México" }] };

function pedir(query: Record<string, string>) {
  const params = new URLSearchParams({ sesionId: "s1", indicadorId: "F1-11", ...query });
  return GET(new Request(`http://localhost/api/fontana/distribucion?${params}`) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(getIndicadorRegistro).mockResolvedValue({ id: "F1-11", nombre: "Urbano/rural", niveles } as never);
  vi.mocked(getMunicipiosOptionsNacional).mockResolvedValue(
    (catalogo as { estadoCve: string; nombre: string }[]).map((m) => ({ ...m, cve: "000", estadoNombre: nombreEstadoDisplay(m.estadoCve) })) as never
  );
  vi.mocked(resolverIndicadorIter).mockImplementation(async () =>
    ["nacional", "estatal", "municipal"].map((nivel) => ({ nivel, valor: 1, distribucion: { urbano: 60, rural: 40 }, unidad: "%" })) as never
  );
  vi.mocked(cargarSesionConTerritorioActual).mockResolvedValue({ sesion: { territorio: territorioActivo }, ref: {} } as never);
});

describe("GET /api/fontana/distribucion (Paso 3)", () => {
  it("«este distrito» va por la rama del proyecto (sin catálogo)", async () => {
    const j = await (await pedir({ territorio: "este distrito" })).json();
    expect(j).toMatchObject({ ok: true, esTerritorioDelProyecto: true, esTerritorioExterno: false });
    expect(vi.mocked(resolverIndicadorIter).mock.calls[0][1]).toBe(territorioActivo);
  });

  it("un municipio nombrado (regresión): desglose municipal, externo", async () => {
    const j = await (await pedir({ territorio: "Guadalajara" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "municipal", esTerritorioExterno: true });
  });

  it("«México» pregunta; elegido el país, el desglose es NACIONAL", async () => {
    expect(await (await pedir({ territorio: "México" })).json()).toMatchObject({ ok: false, referencia: "ambiguo" });
    const j = await (await pedir({ territorio: "México", clave: "MEX" })).json();
    expect(j).toMatchObject({ ok: true, nivel: "nacional", territorio: { label: "México" } });
  });

  it("un distrito nombrado: el desglose no llega al distrito, y se dice", async () => {
    vi.mocked(getIndicadorRegistro).mockResolvedValue({ id: "F1-11", nombre: "Urbano/rural", niveles: niveles.map((n) => ({ ...n, estado: "confirmado" })) } as never);
    const j = await (await pedir({ territorio: "distrito federal 2 de Yucatán" })).json();
    expect(j).toMatchObject({ ok: false, referencia: "nivel_no_disponible" });
    expect(resolverIndicadorIter).not.toHaveBeenCalled();
  });
});
