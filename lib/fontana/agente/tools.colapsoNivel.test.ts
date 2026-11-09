// T7 C5 — la rama `colapsoNivel` de generar_visualizacion (serie_temporal) une el motivo del servidor con una frase fija
// (lo lee el MODELO). Si el motivo no termina en puntuación, antes salía «…municipal No se generó ninguna gráfica.».
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

import { ejecutarHerramienta, type ToolContext } from "./tools";

const ctx = (): ToolContext =>
  ({
    sesionId: "s1", uid: "u1", cookie: "", baseUrl: "http://x", territorio: { nivel: "municipal", pais: "México", estado: "Jalisco", municipio: "Guadalajara" },
    tipoProyecto: "electoral", vizTerritoriosDelTurno: new Set<string>(), municipiosPreguntadosPrevio: false,
    ultimoMensajeUsuario: "la serie de Iztapalapa", ultimoMensajeAsistente: "", canvasItemsSesion: [],
  }) as unknown as ToolContext;

function conRespuesta(cuerpo: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => cuerpo })));
}
const colapso = (motivo?: string) => ({ ok: false, colapsoNivel: true, entregaNivel: "estatal", estado: "Ciudad de México", municipioPedido: "Iztapalapa", ...(motivo !== undefined ? { motivo } : {}) });
const correr = async () => {
  const r = await ejecutarHerramienta("generar_visualizacion", { tipo: "serie_temporal", indicadorId: "F2-5", territorioNombre: "Iztapalapa" }, ctx(), "m1");
  return JSON.stringify(r.resultForModel);
};

afterEach(() => vi.unstubAllGlobals());

describe("colapsoNivel — motivo + frase fija", () => {
  it("un motivo SIN punto final se cierra antes de la frase fija", async () => {
    conRespuesta(colapso("«IDH» no tiene serie municipal"));
    const t = await correr();
    expect(t).toContain("«IDH» no tiene serie municipal. No se generó ninguna gráfica.");
    expect(t).not.toContain("municipal No se generó");
  });
  it("un motivo que ya termina en punto no duplica el punto", async () => {
    conRespuesta(colapso("«IDH» no tiene serie municipal."));
    const t = await correr();
    expect(t).toContain("«IDH» no tiene serie municipal. No se generó ninguna gráfica.");
    expect(t).not.toContain("..");
  });
  it("sin motivo usa el texto por defecto", async () => {
    conRespuesta(colapso());
    expect(await correr()).toContain("Ese indicador no tiene serie a nivel municipal. No se generó ninguna gráfica.");
  });
});
