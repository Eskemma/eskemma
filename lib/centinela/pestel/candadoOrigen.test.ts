// T7 C2 — el candado de origen: confirma (no bloquea), la huella es del servidor, y la lectura del vigente cuesta
// solo cuando hace falta.
import { describe, expect, it, vi } from "vitest";
import type { Firestore, Query, QuerySnapshot } from "firebase-admin/firestore";
import { decidirCandadoOrigen, huellaDeRazonesOrigen, leerVigenteParaGate, respuestaCandadoOrigen } from "./candadoOrigen";
import type { RazonImportabilidad } from "./importabilidad";

const APROBADO = { id: "a1", status: "APPROVED", vigente: true, analyzedAt: "2026-10-01T10:00:00Z", globalConfidence: 80, biasAlerts: [] as unknown[] };
const PENDIENTE = { ...APROBADO, status: "PENDING_REVIEW" };
const SIN = { confirmarOrigen: undefined, huellaOrigen: undefined };

describe("decidirCandadoOrigen", () => {
  it("aprobado y limpio → continuar sin razones", () => {
    expect(decidirCandadoOrigen(APROBADO, null, SIN)).toEqual({ accion: "continuar", razones: [] });
  });

  it("la confianza baja SOLA no pide confirmación: continúa y devuelve la razón para informar", () => {
    const d = decidirCandadoOrigen({ ...APROBADO, globalConfidence: 39 }, null, SIN);
    expect(d.accion).toBe("continuar");
    // T7 C3: APROBADO sin justificación guardada → la razón dice que no hay justificación registrada.
    expect(d.razones).toEqual([{ tipo: "confianza_baja", confianza: 39, nota: "sin_justificacion" }]);
  });

  it("pendiente sin confirmar → requiere_confirmacion con razones y huella", () => {
    const d = decidirCandadoOrigen(PENDIENTE, null, SIN);
    expect(d.accion).toBe("requiere_confirmacion");
    if (d.accion === "continuar") throw new Error("no debía continuar");
    expect(d.razones).toEqual([{ tipo: "no_aprobado", status: "PENDING_REVIEW" }]);
    expect(d.huella).toBe(huellaDeRazonesOrigen(d.razones));
  });

  it("confirmar con LA huella vigente → continuar", () => {
    const pide = decidirCandadoOrigen(PENDIENTE, null, SIN);
    if (pide.accion === "continuar") throw new Error("x");
    expect(decidirCandadoOrigen(PENDIENTE, null, { confirmarOrigen: true, huellaOrigen: pide.huella }).accion).toBe("continuar");
  });

  it("confirmar con huella distinta, ausente o de otro tipo → huella_vencida (se muestra lo nuevo)", () => {
    for (const huellaOrigen of ["otra", undefined, null, 5]) {
      const d = decidirCandadoOrigen(PENDIENTE, null, { confirmarOrigen: true, huellaOrigen });
      expect(d.accion).toBe("huella_vencida");
    }
  });

  it("`confirmarOrigen` distinto de true (texto, 1) no cuenta como confirmación", () => {
    const pide = decidirCandadoOrigen(PENDIENTE, null, SIN);
    if (pide.accion === "continuar") throw new Error("x");
    for (const confirmarOrigen of ["true", 1, "si"]) expect(decidirCandadoOrigen(PENDIENTE, null, { confirmarOrigen, huellaOrigen: pide.huella }).accion).toBe("requiere_confirmacion");
  });

  it("si el estado cambió entre lo mostrado y la confirmación, la huella ya no coincide", () => {
    const pide = decidirCandadoOrigen(PENDIENTE, null, SIN);
    if (pide.accion === "continuar") throw new Error("x");
    const cambiado = { ...PENDIENTE, biasAlerts: [{ type: "u", description: "d" }] };
    expect(decidirCandadoOrigen(cambiado, null, { confirmarOrigen: true, huellaOrigen: pide.huella }).accion).toBe("huella_vencida");
  });

  it("MISMA función fuera y dentro: mismas entradas, misma decisión y misma huella", () => {
    const a = decidirCandadoOrigen({ ...PENDIENTE, vigente: false }, { id: "a2", analyzedAt: "2026-11-02T08:30:00Z" }, SIN);
    const b = decidirCandadoOrigen({ ...PENDIENTE, vigente: false }, { id: "a2", analyzedAt: "2026-11-02T08:30:00Z" }, SIN);
    expect(a).toEqual(b);
  });
});

describe("huellaDeRazonesOrigen", () => {
  const R: RazonImportabilidad[] = [{ tipo: "no_vigente", fechaAnalisis: "x", fechaVigente: "y" }];
  it("no depende del orden de las claves y cambia si cambia un dato", () => {
    const otro = [{ fechaVigente: "y", fechaAnalisis: "x", tipo: "no_vigente" }] as RazonImportabilidad[];
    expect(huellaDeRazonesOrigen(otro)).toBe(huellaDeRazonesOrigen(R));
    expect(huellaDeRazonesOrigen([{ tipo: "no_vigente", fechaAnalisis: "x", fechaVigente: "z" }])).not.toBe(huellaDeRazonesOrigen(R));
    expect(huellaDeRazonesOrigen(R)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("leerVigenteParaGate — costo", () => {
  function dbFalso(docs: { id: string; data: Record<string, unknown> }[], falla = false) {
    const consultas: string[] = [];
    const q = { where: (campo: string) => { consultas.push(campo); return q; } } as unknown as Query;
    const db = { collection: vi.fn(() => q) } as unknown as Firestore;
    const ejecutar = vi.fn(async () => {
      if (falla) throw new Error("boom");
      return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) } as unknown as QuerySnapshot;
    });
    return { db, ejecutar, consultas };
  }

  it("análisis vigente (o `vigente` ausente): 0 lecturas", async () => {
    const { db, ejecutar } = dbFalso([]);
    expect(await leerVigenteParaGate(ejecutar, db, { projectId: "p", vigente: true }, { tolerarFallo: true })).toBeNull();
    expect(await leerVigenteParaGate(ejecutar, db, { projectId: "p" }, { tolerarFallo: true })).toBeNull();
    expect(ejecutar).not.toHaveBeenCalled();
    expect(db.collection).not.toHaveBeenCalled();
  });

  it("análisis no vigente: exactamente 1 consulta, de dos igualdades, y elige el más reciente", async () => {
    const { db, ejecutar, consultas } = dbFalso([
      { id: "v1", data: { analyzedAt: "2026-05-01T00:00:00Z" } },
      { id: "v2", data: { analyzedAt: "2026-09-01T00:00:00Z" } },
    ]);
    const v = await leerVigenteParaGate(ejecutar, db, { projectId: "p", vigente: false }, { tolerarFallo: true });
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(consultas).toEqual(["projectId", "vigente"]);
    expect(v).toEqual({ id: "v2", analyzedAt: "2026-09-01T00:00:00Z" });
  });

  it("sin vigente existente → null (la razón se dice sin esa fecha)", async () => {
    const { db, ejecutar } = dbFalso([]);
    expect(await leerVigenteParaGate(ejecutar, db, { projectId: "p", vigente: false }, { tolerarFallo: true })).toBeNull();
  });

  it("falla de lectura: fuera de la transacción se tolera (null); dentro se propaga", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, ejecutar } = dbFalso([], true);
    expect(await leerVigenteParaGate(ejecutar, db, { projectId: "p", vigente: false }, { tolerarFallo: true })).toBeNull();
    await expect(leerVigenteParaGate(ejecutar, db, { projectId: "p", vigente: false }, { tolerarFallo: false })).rejects.toThrow("boom");
  });

  it("sin projectId legible no consulta", async () => {
    const { db, ejecutar } = dbFalso([]);
    expect(await leerVigenteParaGate(ejecutar, db, { vigente: false }, { tolerarFallo: true })).toBeNull();
    expect(ejecutar).not.toHaveBeenCalled();
  });
});

describe("respuestaCandadoOrigen", () => {
  it("409 con código, razones, huella y `lineas: []`; la vencida usa su propio código", async () => {
    const pide = decidirCandadoOrigen(PENDIENTE, null, SIN);
    if (pide.accion === "continuar") throw new Error("x");
    const r = respuestaCandadoOrigen(pide);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "origen_requiere_confirmacion", razones: pide.razones, huella: pide.huella, lineas: [] });
    const v = respuestaCandadoOrigen({ ...pide, accion: "huella_vencida" });
    expect((await v.json()).error).toBe("origen_huella_vencida");
  });
});
