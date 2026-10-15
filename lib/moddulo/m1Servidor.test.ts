// m1Servidor: reads the M1 review state out of the raw `phases.exploracion` (server-only).
import { describe, expect, it, vi } from "vitest";
import { analizarM1, resumenM1ParaCliente } from "./m1Servidor";
import { aprobacionDe, docProyectoM1, huellaDe, mapaM1 } from "./__tests__/fixtures/m1Siembra";

vi.mock("firebase-admin/firestore", () => ({ FieldValue: {} }));
const exp = (o: Parameters<typeof docProyectoM1>[0] = {}) => docProyectoM1(o).phases.exploracion as never;

describe("analizarM1", () => {
  it("lee payload, kind, huella y marca la fase cerrada", () => {
    const a = analizarM1(exp({ kind: "T22", status: "completed" }));
    expect(a).toMatchObject({ kind: "T22", cerrada: true, huellaPayload: huellaDe(mapaM1()) });
    expect(a.impacto).toMatchObject({ hayPayload: true, totalDimensiones: 6, aprobada: false });
  });
  it("aprobación válida solo si la huella coincide; la de impacto trae la huella aprobada y la de generación", () => {
    const ok = analizarM1(exp({ m1: { aprobacion: aprobacionDe(mapaM1()), generacion: { huella: "G", en: "t" } } }));
    expect(ok.estado).toMatchObject({ estado: "aprobado", aprobacionValida: true, motoresSinGenerar: true });
    expect(ok.impacto).toMatchObject({ aprobada: true, huellaAprobacion: huellaDe(mapaM1()), huellaGeneracion: "G" });
    const vieja = analizarM1(exp({ m1: { aprobacion: aprobacionDe(mapaM1(), { huella: "x" }) } }));
    expect(vieja.estado.aprobacionValida).toBe(false);
    expect(vieja.impacto.huellaAprobacion).toBeNull();
  });
  it("lista motores aprobados (solo M2–M5 en true), borrador y dvs; sin payload no hay huella", () => {
    const a = analizarM1(exp({ payload: null, draftDVS: { x: 1 }, dvs: { y: 1 }, motorAprobaciones: { M2: true, M3: false, M5: true } }));
    expect(a.huellaPayload).toBeNull();
    expect(a.estado.estado).toBe("sin_m1_con_restos");
    expect(a.impacto).toMatchObject({ motoresAprobados: ["M2", "M5"], hayBorrador: true, hayDvs: true, hayPayload: false });
  });
  it("un payload vacío ({}) cuenta como sin M1; sin exploración tampoco falla", () => {
    expect(analizarM1(exp({ payload: {} as never })).payload).toBeNull();
    expect(analizarM1(undefined).estado.estado).toBe("sin_m1");
  });
  it("resumenM1ParaCliente expone la huella y las dimensiones con edición vigente", () => {
    const doc = docProyectoM1();
    doc.phases.exploracion.linkedSource!.payload!.S!.narrativa = "mía";
    (doc.phases.exploracion as Record<string, unknown>).m1 = { ediciones: { "S.narrativa": { original: "IA S", editado: "mía", por: "u", en: "t" } } };
    const r = resumenM1ParaCliente(doc.phases.exploracion as never);
    expect(r.dimensionesEditadas).toEqual(["S"]);
    expect(r.huella).toMatch(/^[0-9a-f]{64}$/);
  });
});
