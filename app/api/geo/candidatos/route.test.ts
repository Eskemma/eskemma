// app/api/geo/candidatos/route.test.ts
// POST /api/geo/candidatos: validates its input, injects the (mocked) municipality
// catalog into the pure core and returns its result. The rules themselves are tested
// in lib/geo/desambiguar.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import catalogo from "@/lib/geo/__fixtures__/municipios_catalogo.json";

vi.mock("@/lib/geo/municipios", () => ({
  getMunicipiosOptionsNacional: vi.fn(),
}));

import { getMunicipiosOptionsNacional } from "@/lib/geo/municipios";
import { POST } from "./route";

const mockCatalogo = vi.mocked(getMunicipiosOptionsNacional);

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/geo/candidatos", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/geo/candidatos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCatalogo.mockResolvedValue(
      (catalogo as { estadoCve: string; nombre: string }[]).map((m, i) => ({
        ...m,
        cve: String(i),
        estadoNombre: m.estadoCve,
      }))
    );
  });

  it("único: Pachuca acotada a municipio", async () => {
    const res = await POST(buildRequest({ texto: "Pachuca", tipos: ["municipio"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.estado).toBe("unico");
    expect(json.candidato).toMatchObject({ clave: "13:PACHUCA DE SOTO", coincidencia: "parcial" });
  });

  it("ambiguo: Ixtlahuacán con estado 'Jalisco'", async () => {
    const res = await POST(buildRequest({ texto: "Ixtlahuacán", estado: "Jalisco", tipos: ["municipio"] }));
    const json = await res.json();
    expect(json.estado).toBe("ambiguo");
    expect(json.candidatos).toHaveLength(2);
  });

  it("demasiados: San Juan", async () => {
    const json = await (await POST(buildRequest({ texto: "San Juan", tipos: ["municipio"] }))).json();
    expect(json).toMatchObject({ estado: "demasiados", total: 63 });
  });

  it("Santiago (1 exacto + 64 parciales) → demasiados con el exacto en `exactas`", async () => {
    const json = await (await POST(buildRequest({ texto: "Santiago", tipos: ["municipio"] }))).json();
    expect(json).toMatchObject({ estado: "demasiados", total: 65 });
    expect(json.exactas.map((c: { clave: string }) => c.clave)).toEqual(["19:SANTIAGO"]);
  });

  it("alias coloquiales por el endpoint: Neza y Ciudad Juárez", async () => {
    const neza = await (await POST(buildRequest({ texto: "Neza", tipos: ["municipio"] }))).json();
    expect(neza.candidato).toMatchObject({ clave: "15:NEZAHUALCOYOTL", coincidencia: "alias" });
    const juarez = await (await POST(buildRequest({ texto: "Ciudad Juárez", estado: "Chihuahua", tipos: ["municipio"] }))).json();
    expect(juarez.candidato).toMatchObject({ clave: "08:JUAREZ", coincidencia: "alias" });
  });

  it("México sin contexto pregunta, y `mexico` lo fija; sin municipios no carga el catálogo", async () => {
    const pregunta = await (await POST(buildRequest({ texto: "México", tipos: ["pais", "estado"] }))).json();
    expect(pregunta.estado).toBe("ambiguo");
    const fijado = await (await POST(buildRequest({ texto: "México", tipos: ["pais", "estado"], mexico: "pais" }))).json();
    expect(fijado.candidato.clave).toBe("MEX");
    expect(mockCatalogo).not.toHaveBeenCalled();
  });

  it("los dos municipios homónimos de Oaxaca llegan con el cve del catálogo", async () => {
    const json = await (await POST(buildRequest({ texto: "San Juan Mixtepec", tipos: ["municipio"] }))).json();
    expect(json.candidatos).toHaveLength(2);
    expect(json.candidatos[0].clave).toMatch(/^20:SAN JUAN MIXTEPEC#\d+$/);
    expect(json.candidatos[0].clave).not.toBe(json.candidatos[1].clave);
  });

  it.each([
    ["JSON inválido", "no es json"],
    ["sin texto", {}],
    ["texto vacío", { texto: "   " }],
    ["texto que no es string", { texto: 5 }],
    ["texto demasiado largo", { texto: "a".repeat(101) }],
    ["estado no reconocido", { texto: "Pachuca", estado: "Narnia" }],
    ["estado que no es string", { texto: "Pachuca", estado: 7 }],
    ["tipos vacío", { texto: "Pachuca", tipos: [] }],
    ["tipo desconocido", { texto: "Pachuca", tipos: ["municipio", "colonia"] }],
    ["tipos que no es lista", { texto: "Pachuca", tipos: "municipio" }],
    ["mexico inválido", { texto: "México", mexico: "otro" }],
  ])("400 ante entrada inválida: %s", async (_caso, body) => {
    const res = await POST(buildRequest(body));
    expect(res.status).toBe(400);
    expect(mockCatalogo).not.toHaveBeenCalled();
  });

  it("500 (no cuelga) si el catálogo falla", async () => {
    mockCatalogo.mockRejectedValue(new Error("Storage caído"));
    const res = await POST(buildRequest({ texto: "Pachuca" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("Storage caído");
  });
});
