import { describe, expect, it, vi } from "vitest";
import { avisarProyectoActualizado, EVENTO_PROYECTO_ACTUALIZADO, suscribirProyectoActualizado } from "./eventosProyecto";

describe("eventosProyecto (destino inyectado)", () => {
  it("el nombre del evento es fijo", () => {
    expect(EVENTO_PROYECTO_ACTUALIZADO).toBe("moddulo:proyecto-actualizado");
  });
  it("avisar llega a quien se suscribió a ESE proyecto", () => {
    const t = new EventTarget();
    const cb = vi.fn();
    suscribirProyectoActualizado("p1", cb, t);
    avisarProyectoActualizado("p1", t);
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it("el aviso de otro proyecto se ignora", () => {
    const t = new EventTarget();
    const cb = vi.fn();
    suscribirProyectoActualizado("p1", cb, t);
    avisarProyectoActualizado("p2", t);
    expect(cb).not.toHaveBeenCalled();
  });
  it("el desuscriptor deja de recibir avisos", () => {
    const t = new EventTarget();
    const cb = vi.fn();
    const baja = suscribirProyectoActualizado("p1", cb, t);
    baja();
    avisarProyectoActualizado("p1", t);
    expect(cb).not.toHaveBeenCalled();
  });
  it("varios suscriptores reciben el mismo aviso y uno que se da de baja no afecta al otro", () => {
    const t = new EventTarget();
    const a = vi.fn();
    const b = vi.fn();
    const bajaA = suscribirProyectoActualizado("p1", a, t);
    suscribirProyectoActualizado("p1", b, t);
    bajaA();
    avisarProyectoActualizado("p1", t);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
  it("ids vacíos o sin destino no lanzan ni avisan", () => {
    const t = new EventTarget();
    const cb = vi.fn();
    suscribirProyectoActualizado("", cb, t);
    avisarProyectoActualizado("", t);
    expect(cb).not.toHaveBeenCalled();
    expect(() => avisarProyectoActualizado("p1", null)).not.toThrow();
    expect(suscribirProyectoActualizado("p1", cb, null)).toBeTypeOf("function");
  });
});
