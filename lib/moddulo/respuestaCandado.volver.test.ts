// C4b-1b — `respuestaCandado` acepta una decisión MÍNIMA (Pick) y un `nombre` aditivo; con una decisión completa de F2
// el cuerpo es EXACTAMENTE el de siempre (sin `nombre`, con las líneas calculadas por defecto).
import { describe, expect, it } from "vitest";
import { respuestaCandado } from "./respuestaCandado";
import { decidirCandadoReemplazo, calcularImpactoReemplazoDVS } from "./impactoReemplazoDVS";

describe("respuestaCandado", () => {
  it("decisión mínima: pregunta con SUS líneas, huella, hayImpactoF3 y nombre", async () => {
    const r = respuestaCandado("requiere_confirmacion", { motivoBloqueo: null, hayImpactoF3: true, huella: "h1" }, { lineas: ["a", "b"], nombre: "¿Pregunta?" });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "reemplazo_requiere_confirmacion", lineas: ["a", "b"], hayImpactoF3: true, huella: "h1", nombre: "¿Pregunta?" });
  });
  it("huella vencida lleva el mismo cuerpo con otro código", async () => {
    const r = respuestaCandado("huella_vencida", { motivoBloqueo: null, hayImpactoF3: false, huella: "h2" }, { lineas: [] });
    expect((await r.json()).error).toBe("reemplazo_huella_vencida");
  });
  it("sin `lineas` y sin `impacto` en la decisión mínima: líneas vacías (no se calcula nada)", async () => {
    const b = await respuestaCandado("requiere_confirmacion", { motivoBloqueo: null, hayImpactoF3: false, huella: "h" }).json();
    expect(b.lineas).toEqual([]);
  });
  it("bloqueado: solo el motivo", async () => {
    const r = respuestaCandado("bloqueado", { motivoBloqueo: "MOTIVO", hayImpactoF3: false, huella: "" });
    expect(await r.json()).toEqual({ error: "reemplazo_bloqueado", mensaje: "MOTIVO" });
  });
  it("`nombre` vacío o ausente no agrega la clave", async () => {
    const b = await respuestaCandado("requiere_confirmacion", { motivoBloqueo: null, hayImpactoF3: false, huella: "h" }, { lineas: [], nombre: "" }).json();
    expect("nombre" in b).toBe(false);
  });
  it("caracterización F2: con una decisión COMPLETA las líneas por defecto siguen saliendo de `lineasDeImpacto` y no hay `nombre`", async () => {
    const decision = decidirCandadoReemplazo({
      decision: calcularImpactoReemplazoDVS(
        { tareas: [{ pipItemId: "t1", asignaciones: [{ asignacionId: "a", tipo: "primaria", canal: "canal1", justificacion: "j", estado: "en_curso", activada: true }] } as never], resultados: [], sintesis: undefined, veredicto: undefined, die: undefined, dvsHuella: "x" } as never,
        "reemplazo_total"
      ),
      confirmar: false,
      huellaRecibida: null,
    }).decision;
    const b = await respuestaCandado("requiere_confirmacion", decision).json();
    expect(Array.isArray(b.lineas)).toBe(true);
    expect("nombre" in b).toBe(false);
    expect(b.huella).toBe(decision.huella);
  });
});
