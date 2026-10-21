// 4f: the text of a model failure depends on its cause (generar_motores and generar_m1).
import { describe, expect, it } from "vitest";
import { decidirResultadoGuardado, textoPorCausa, type RespuestaGuardado } from "./guardadoHonesto";
import { leerRespuestaGuardado } from "./leerRespuestaGuardado";

const r500 = (extra: Partial<Extract<RespuestaGuardado, { tipo: "respuesta" }>>): RespuestaGuardado => ({
  tipo: "respuesta", ok: false, status: 500, codigo: "fallo_modelo", ...extra,
});
const msg = (a: Parameters<typeof decidirResultadoGuardado>[0], r: RespuestaGuardado) => decidirResultadoGuardado(a, r).mensajeError ?? "";

const SALDO = "El servicio de generación no está disponible por un problema con la cuenta del proveedor. Avisa al equipo de Eskemma y vuelve a intentarlo más tarde.";
const LIMITE = "El servicio está recibiendo demasiadas solicitudes. Espera unos minutos y reintenta.";
const SOBRE = "El servicio está saturado en este momento. Espera unos minutos y reintenta.";
const FIJO = "Tu análisis sigue aprobado; M2–M5 no se generaron.";

describe("generar_motores — texto por causa", () => {
  it.each([["saldo", SALDO], ["limite", LIMITE], ["sobrecarga", SOBRE]] as const)("causa %s", (causa, texto) => {
    const m = msg("generar_motores", r500({ motor: "M2/M3", causa }));
    expect(m).toContain(texto);
    expect(m).toContain(FIJO);
  });
  it("otro, ausente o desconocida → el texto actual", () => {
    const actual = `No se pudo generar M2 o M3. ${FIJO} Reintentar generación.`;
    expect(msg("generar_motores", r500({ motor: "M2/M3", causa: "otro" }))).toBe(actual);
    expect(msg("generar_motores", r500({ motor: "M2/M3" }))).toBe(actual);
    expect(msg("generar_motores", r500({ motor: "M2/M3", causa: "cuenta" as never }))).toBe(actual);
  });
  it("sin motor (500 ambiguo) la causa no vuelve cierto el fallo", () => {
    expect(msg("generar_motores", r500({ causa: "saldo" }))).toContain("No se pudo CONFIRMAR");
  });
  it("ningún texto menciona «Claude» ni códigos internos", () => {
    for (const causa of ["saldo", "limite", "sobrecarga", "otro"] as const) {
      expect(msg("generar_motores", r500({ motor: "M5", causa }))).not.toMatch(/Claude|fallo_modelo|\b(saldo|limite|sobrecarga)\b/);
    }
  });
});

describe("generar_m1 — texto por causa", () => {
  it.each([["saldo", "servicio de generación no está disponible"], ["limite", "demasiadas solicitudes"], ["sobrecarga", "saturado"]] as const)("causa %s", (causa, frag) => {
    const m = msg("generar_m1", r500({ causa, dimensiones: "T, Ec y L" }));
    expect(m).toContain("No se pudo generar T, Ec y L");
    expect(m).toContain(frag);
    expect(m).toContain("No se guardó nada.");
    expect(m).not.toMatch(/Claude|fallo_modelo/);
  });
  it("otro, ausente o desconocida → el texto actual", () => {
    const actual = "No se pudo generar T, Ec y L: el servicio de análisis no respondió. No se guardó nada; inténtalo de nuevo.";
    expect(msg("generar_m1", r500({ causa: "otro", dimensiones: "T, Ec y L" }))).toBe(actual);
    expect(msg("generar_m1", r500({ dimensiones: "T, Ec y L" }))).toBe(actual);
    expect(msg("generar_m1", r500({ causa: "x" as never, dimensiones: "T, Ec y L" }))).toBe(actual);
  });
});

describe("textoPorCausa y lectura del cuerpo", () => {
  it("solo las tres causas con texto propio", () => {
    expect(textoPorCausa("saldo")).toBe(SALDO);
    expect(textoPorCausa("otro")).toBeNull();
    expect(textoPorCausa(undefined)).toBeNull();
  });
  it("leerRespuestaGuardado conserva una causa válida y descarta una desconocida", async () => {
    const mk = (causa: unknown) => () => Promise.resolve(new Response(JSON.stringify({ codigo: "fallo_modelo", motor: "M5", causa }), { status: 500 }));
    const ok = await leerRespuestaGuardado(mk("limite"));
    expect(ok.resp).toMatchObject({ causa: "limite" });
    const mal = await leerRespuestaGuardado(mk("<script>"));
    expect(mal.resp).not.toHaveProperty("causa");
  });
});
