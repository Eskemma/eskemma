import { describe, expect, it } from "vitest";
import {
  MOTIVO_BLOQUEO_DIE,
  lineasDeImpactoEdicion,
  motivoBloqueoDIE,
  calcularImpactoReemplazoDVS,
  tareaTieneProgreso,
  type EstadoParaImpacto,
} from "./impactoReemplazoDVS";
import type { AsignacionCanal, DVSF2, TareaPIP } from "@/types/moddulo.types";

const asig = (over: Partial<AsignacionCanal> = {}): AsignacionCanal => ({
  asignacionId: "a", tipo: "primaria", canal: "canal2", justificacion: "", estado: "pendiente", activada: true, ...over,
} as AsignacionCanal);
const tarea = (pipItemId: string, asignaciones: AsignacionCanal[] = [asig()]): TareaPIP => ({ pipItemId, asignaciones });
const dvs = { hei: {}, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;

const base = (over: Partial<EstadoParaImpacto> = {}): EstadoParaImpacto => ({ dvs, tareas: [], resultados: [], ...over });

describe("tareaTieneProgreso (extraída de tareas/generar)", () => {
  it("pendiente sin resultado ni desactivación → sin progreso", () => {
    expect(tareaTieneProgreso(tarea("p1"))).toBe(false);
  });
  it("estado distinto de pendiente → progreso", () => {
    expect(tareaTieneProgreso(tarea("p1", [asig({ estado: "en_curso" })]))).toBe(true);
  });
  it("resultadoId → progreso", () => {
    expect(tareaTieneProgreso(tarea("p1", [asig({ resultadoId: "r1" })]))).toBe(true);
  });
  it("vía desactivada a mano → progreso", () => {
    expect(tareaTieneProgreso(tarea("p1", [asig({ activada: false })]))).toBe(true);
  });
  it("sin asignaciones → sin progreso", () => {
    expect(tareaTieneProgreso({ asignaciones: undefined as never })).toBe(false);
  });
});

describe("calcularImpactoReemplazoDVS — reemplazo total (M8)", () => {
  it("sin dvs: no hay nada que reemplazar ni confirmar", () => {
    const d = calcularImpactoReemplazoDVS(base({ dvs: null }), "reemplazo_total");
    expect(d).toMatchObject({ bloquear: false, requiereConfirmacion: false, hayImpactoF3: false });
  });

  it("dvs sin tablero: pide confirmación SIEMPRE, sin líneas de impacto de F3", () => {
    const d = calcularImpactoReemplazoDVS(base(), "reemplazo_total");
    expect(d).toMatchObject({ bloquear: false, requiereConfirmacion: true, hayImpactoF3: false });
    expect(d.impacto).toMatchObject({ tareasAfectadas: 0, tareasConAvance: 0, resultadosAprobados: 0 });
  });

  it("tablero sin avance: confirma y SÍ hay impacto de F3 (las tareas quedan huérfanas)", () => {
    const d = calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1"), tarea("p2")] }), "reemplazo_total");
    expect(d.requiereConfirmacion).toBe(true);
    expect(d.hayImpactoF3).toBe(true);
    expect(d.impacto).toMatchObject({ tareasAfectadas: 2, tareasConAvance: 0 });
  });

  it("tablero con avance: cuenta las tareas con avance y lista sus ids", () => {
    const d = calcularImpactoReemplazoDVS(
      base({ tareas: [tarea("p1", [asig({ estado: "recibido", resultadoId: "r1" })]), tarea("p2")] }),
      "reemplazo_total"
    );
    expect(d.impacto.tareasConAvance).toBe(1);
    expect(d.impacto.idsTareasConAvance).toEqual(["p1"]);
  });

  it("resultados: cuenta recibidos y aprobados por separado", () => {
    const d = calcularImpactoReemplazoDVS(
      base({ resultados: [{ resultadoId: "r1", aprobado: true }, { resultadoId: "r2", aprobado: false }, { resultadoId: "r3" }] }),
      "reemplazo_total"
    );
    expect(d.impacto).toMatchObject({ resultadosRecibidos: 3, resultadosAprobados: 1, idsResultadosAprobados: ["r1"] });
    expect(d.hayImpactoF3).toBe(true);
  });

  it("síntesis: queda afectada", () => {
    const d = calcularImpactoReemplazoDVS(base({ sintesis: { vaciosResiduales: [], fodaAdversariosInsumo: {} } }), "reemplazo_total");
    expect(d.impacto.sintesisAfectada).toBe(true);
    expect(d.hayImpactoF3).toBe(true);
  });

  it("veredicto (sin DIE): confirma, no bloquea", () => {
    const d = calcularImpactoReemplazoDVS(base({ veredicto: { resultado: "validada" } }), "reemplazo_total");
    expect(d).toMatchObject({ bloquear: false, requiereConfirmacion: true });
    expect(d.impacto.veredictoExiste).toBe(true);
  });

  it("DIE existente: BLOQUEA (provisional) con el motivo y sin pedir confirmación", () => {
    const d = calcularImpactoReemplazoDVS(base({ die: { tableroTareasPIP: [] } }), "reemplazo_total");
    expect(d).toMatchObject({ bloquear: true, requiereConfirmacion: false, motivoBloqueo: MOTIVO_BLOQUEO_DIE });
    expect(MOTIVO_BLOQUEO_DIE).toContain("reabrir la Fase 3 aún no está disponible");
  });
});

describe("calcularImpactoReemplazoDVS — por ids (finalize-dvs, commit 3)", () => {
  const estado = base({
    tareas: [tarea("p1", [asig({ estado: "recibido", resultadoId: "r1" })]), tarea("p2"), tarea("p3")],
    resultados: [{ resultadoId: "r1", aprobado: true }, { resultadoId: "r9", aprobado: true }],
    sintesis: { vaciosResiduales: [{ pipItemId: "p3" }], fodaAdversariosInsumo: { a1: {} } },
  });

  it("ediciones que conservan todos los ids (conjuntos vacíos): sin impacto, sin confirmar, sin bloquear — aun con DIE", () => {
    const vacio = { idsPipEliminados: [], idsActorEliminados: [] };
    for (const e of [estado, { ...estado, die: { x: 1 } }]) {
      const d = calcularImpactoReemplazoDVS(e, vacio);
      expect(d).toMatchObject({ bloquear: false, requiereConfirmacion: false, hayImpactoF3: false });
    }
  });

  it("eliminar una pregunta con avance: solo cuenta lo conectado a ese id", () => {
    const d = calcularImpactoReemplazoDVS(estado, { idsPipEliminados: ["p1"], idsActorEliminados: [] });
    expect(d.requiereConfirmacion).toBe(true);
    // r1 cuelga de p1 (se pierde su vínculo); r9 no cuelga de ninguna tarea eliminada.
    expect(d.impacto).toMatchObject({ tareasAfectadas: 1, tareasConAvance: 1, resultadosRecibidos: 1, resultadosAprobados: 1, idsResultadosAprobados: ["r1"] });
    expect(d.impacto.sintesisAfectada).toBe(false);
  });

  it("eliminar la pregunta citada por la síntesis, o su actor: la síntesis queda afectada", () => {
    expect(calcularImpactoReemplazoDVS(estado, { idsPipEliminados: ["p3"], idsActorEliminados: [] }).impacto.sintesisAfectada).toBe(true);
    expect(calcularImpactoReemplazoDVS(estado, { idsPipEliminados: [], idsActorEliminados: ["a1"] }).impacto.sintesisAfectada).toBe(true);
  });

  it("DIE + id eliminado que F3 usa: bloquea; DIE + id que nadie usa: no", () => {
    const conDie = { ...estado, die: { x: 1 } };
    expect(calcularImpactoReemplazoDVS(conDie, { idsPipEliminados: ["p2"], idsActorEliminados: [] }).bloquear).toBe(true);
    expect(calcularImpactoReemplazoDVS(conDie, { idsPipEliminados: ["otro"], idsActorEliminados: [] }).bloquear).toBe(false);
  });
});

describe("huella", () => {
  const e1 = base({ tareas: [tarea("p1", [asig({ estado: "recibido" })]), tarea("p2")] });

  it("es estable para el mismo estado, sea cual sea el orden de claves o de ids", () => {
    const e2 = base({ tareas: [tarea("p1", [asig({ estado: "recibido" })]), tarea("p2")] });
    expect(calcularImpactoReemplazoDVS(e1, "reemplazo_total").huella).toBe(calcularImpactoReemplazoDVS(e2, "reemplazo_total").huella);
  });

  it("dos cambios OPUESTOS (una tarea gana avance, otra lo pierde) dan huellas distintas aunque los conteos coincidan", () => {
    const a = base({ tareas: [tarea("p1", [asig({ estado: "recibido" })]), tarea("p2")] });
    const b = base({ tareas: [tarea("p1"), tarea("p2", [asig({ estado: "recibido" })])] });
    const da = calcularImpactoReemplazoDVS(a, "reemplazo_total");
    const db = calcularImpactoReemplazoDVS(b, "reemplazo_total");
    expect(da.impacto.tareasConAvance).toBe(db.impacto.tareasConAvance);
    expect(da.huella).not.toBe(db.huella);
  });

  it("dos resultados aprobados distintos (mismo conteo) dan huellas distintas", () => {
    const a = base({ resultados: [{ resultadoId: "r1", aprobado: true }, { resultadoId: "r2" }] });
    const b = base({ resultados: [{ resultadoId: "r1" }, { resultadoId: "r2", aprobado: true }] });
    expect(calcularImpactoReemplazoDVS(a, "reemplazo_total").huella).not.toBe(calcularImpactoReemplazoDVS(b, "reemplazo_total").huella);
  });

  it("el modo también entra en la huella", () => {
    expect(calcularImpactoReemplazoDVS(e1, "reemplazo_total").huella).not.toBe(
      calcularImpactoReemplazoDVS(e1, { idsPipEliminados: ["p1"], idsActorEliminados: [] }).huella
    );
  });
});

describe("comportamiento ACTUAL de M8 (reemplaza siempre, sin avisar) vs el nuevo cálculo", () => {
  const actual = () => ({ pideConfirmacion: false, bloquea: false });
  const casos: [string, EstadoParaImpacto][] = [
    ["dvs sin tablero", base()],
    ["con avance", base({ tareas: [tarea("p1", [asig({ estado: "recibido" })])] })],
    ["con resultados aprobados", base({ resultados: [{ resultadoId: "r1", aprobado: true }] })],
    ["con síntesis", base({ sintesis: { vaciosResiduales: [] } })],
    ["con DIE", base({ die: {} })],
  ];
  it.each(casos)("%s: el comportamiento actual no avisa; el nuevo sí (confirma o bloquea)", (_n, e) => {
    const d = calcularImpactoReemplazoDVS(e, "reemplazo_total");
    expect(actual()).toEqual({ pideConfirmacion: false, bloquea: false });
    expect(d.requiereConfirmacion || d.bloquear).toBe(true);
  });
});

// ── commit 2: candado, líneas de impacto, huella con hash del dvs ────────────

import {
  ReemplazoRechazadoError,
  decidirCandadoReemplazo,
  lineasDeImpacto,
} from "./impactoReemplazoDVS";

describe("MOTIVO_BLOQUEO_DIE — verdadero por construcción y sin «DIE»", () => {
  it("usa los rótulos de pantalla y no la sigla", () => {
    expect(MOTIVO_BLOQUEO_DIE).not.toMatch(/\bDIE\b/);
    expect(MOTIVO_BLOQUEO_DIE).toContain("«M4 · Veredicto HEI»");
    expect(MOTIVO_BLOQUEO_DIE).toContain("«Reporte F3»");
    expect(MOTIVO_BLOQUEO_DIE).toContain("reabrir la Fase 3 aún no está disponible");
  });
});

describe("huella — incluye el hash del dvs vigente", () => {
  const dvsA = { hei: { tensionCentral: "A" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
  const dvsB = { hei: { tensionCentral: "B" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [] } as unknown as DVSF2;
  it("otro dvs con el mismo impacto de F3 → otra huella", () => {
    const a = calcularImpactoReemplazoDVS(base({ dvs: dvsA }), "reemplazo_total");
    const b = calcularImpactoReemplazoDVS(base({ dvs: dvsB }), "reemplazo_total");
    expect(a.impacto).toEqual(b.impacto);
    expect(a.huella).not.toBe(b.huella);
  });
  it("el mismo dvs con claves en otro orden → misma huella", () => {
    const reordenado = { pip: [], incertidumbres: [], semaforo: [], contrasteXPCTO: [], hei: { tensionCentral: "A" } } as unknown as DVSF2;
    expect(calcularImpactoReemplazoDVS(base({ dvs: dvsA }), "reemplazo_total").huella).toBe(
      calcularImpactoReemplazoDVS(base({ dvs: reordenado }), "reemplazo_total").huella
    );
  });
});

describe("decidirCandadoReemplazo", () => {
  const conTablero = calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1")] }), "reemplazo_total");
  const conDie = calcularImpactoReemplazoDVS(base({ die: { x: 1 } }), "reemplazo_total");
  const sinDvs = calcularImpactoReemplazoDVS(base({ dvs: null }), "reemplazo_total");

  it("sin confirmar → requiere confirmación (aunque no haya impacto en F3)", () => {
    expect(decidirCandadoReemplazo({ decision: conTablero, confirmar: false, huellaRecibida: null }).accion).toBe("requiere_confirmacion");
    const sinTablero = calcularImpactoReemplazoDVS(base(), "reemplazo_total");
    expect(decidirCandadoReemplazo({ decision: sinTablero, confirmar: false, huellaRecibida: undefined }).accion).toBe("requiere_confirmacion");
  });
  it("confirmar sin huella, o huella sin confirmar → sigue pidiendo confirmación", () => {
    expect(decidirCandadoReemplazo({ decision: conTablero, confirmar: true, huellaRecibida: null }).accion).toBe("requiere_confirmacion");
    expect(decidirCandadoReemplazo({ decision: conTablero, confirmar: false, huellaRecibida: conTablero.huella }).accion).toBe("requiere_confirmacion");
  });
  it("confirmar con la huella vigente → continuar", () => {
    expect(decidirCandadoReemplazo({ decision: conTablero, confirmar: true, huellaRecibida: conTablero.huella }).accion).toBe("continuar");
  });
  it("confirmar con una huella distinta → huella vencida", () => {
    expect(decidirCandadoReemplazo({ decision: conTablero, confirmar: true, huellaRecibida: "otra" }).accion).toBe("huella_vencida");
  });
  it("DIE → bloqueado, aunque venga la huella correcta", () => {
    expect(decidirCandadoReemplazo({ decision: conDie, confirmar: true, huellaRecibida: conDie.huella }).accion).toBe("bloqueado");
  });
  it("sin dvs → continuar (primera generación, nada que reemplazar)", () => {
    expect(decidirCandadoReemplazo({ decision: sinDvs, confirmar: false, huellaRecibida: null }).accion).toBe("continuar");
  });
  it("ReemplazoRechazadoError conserva la acción y la decisión", () => {
    const e = new ReemplazoRechazadoError("huella_vencida", conTablero);
    expect(e.accion).toBe("huella_vencida");
    expect(e.decision).toBe(conTablero);
  });
});

describe("lineasDeImpacto — rótulos y palabras que F3 ya muestra", () => {
  it("sin impacto en F3 → ninguna línea", () => {
    expect(lineasDeImpacto(calcularImpactoReemplazoDVS(base(), "reemplazo_total"))).toEqual([]);
  });
  it("tablero con avance: usa «M1 · Tablero de tareas», el aviso real de F3 y «Sincronizar tablero ↺»", () => {
    const l = lineasDeImpacto(
      calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1", [asig({ estado: "recibido" })]), tarea("p2")] }), "reemplazo_total")
    );
    expect(l).toHaveLength(1);
    expect(l[0]).toContain("2 tareas de «M1 · Tablero de tareas» (1 con avance) quedarán sin su pregunta");
    expect(l[0]).toContain("«El PIP cambió desde que se generó el tablero de investigación»");
    expect(l[0]).toContain("«Sincronizar tablero ↺» las retirará");
  });
  it("singular: 1 tarea, 1 resultado", () => {
    const l = lineasDeImpacto(
      calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1")], resultados: [{ resultadoId: "r1", aprobado: true }] }), "reemplazo_total")
    );
    expect(l[0]).toContain("1 tarea de «M1 · Tablero de tareas» quedará sin su pregunta");
    expect(l[0]).toContain("la retirará");
    expect(l[1]).toContain("1 resultado de «M2 · Resultados recibidos» (1 aprobado) quedará asociado");
  });
  it("síntesis y veredicto: dice qué pasará, sin inventar un aviso que F3 no muestra", () => {
    const l = lineasDeImpacto(
      calcularImpactoReemplazoDVS(base({ sintesis: { vaciosResiduales: [] }, veredicto: { resultado: "validada" } }), "reemplazo_total")
    );
    const texto = l.join(" ");
    expect(texto).toContain("«M3 · Síntesis de hallazgos» seguirá citando");
    expect(texto).toContain("F3 no lo señalará");
    expect(texto).toContain("«M4 · Veredicto HEI» ya se generó");
    expect(texto).not.toContain("desactualizada");
  });
});

// ── commit 3: edición manual (modo por ids eliminados) ───────────────────────

const edicion = (pip: string[], actor: string[] = []) => ({ idsPipEliminados: pip, idsActorEliminados: actor });

describe("calcularImpactoReemplazoDVS — ids eliminados (finalize-dvs, commit 3)", () => {
  const conAvance = base({
    tareas: [tarea("p1", [asig({ estado: "en_curso" })]), tarea("p2")],
    resultados: [{ resultadoId: "r1", aprobado: true }],
  });
  it("B — la huella incluye los ids eliminados: una confirmación para quitar p1 no sirve para quitar p2", () => {
    const quitarP1 = calcularImpactoReemplazoDVS(conAvance, edicion(["p1"]));
    const quitarP2 = calcularImpactoReemplazoDVS(conAvance, edicion(["p2"]));
    const quitarAmbas = calcularImpactoReemplazoDVS(conAvance, edicion(["p1", "p2"]));
    expect(new Set([quitarP1.huella, quitarP2.huella, quitarAmbas.huella]).size).toBe(3);
    // Mismo impacto F3 (p2 y p3 no tienen nada colgado) pero ids distintos → huella distinta.
    const a = calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1")] }), edicion(["p2"]));
    const b = calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1")] }), edicion(["p3"]));
    expect(a.impacto).toEqual(b.impacto);
    expect(a.huella).not.toBe(b.huella);
  });
  it("el orden de los ids no cambia la huella", () => {
    expect(calcularImpactoReemplazoDVS(conAvance, edicion(["p1", "p2"])).huella).toBe(
      calcularImpactoReemplazoDVS(conAvance, edicion(["p2", "p1"])).huella
    );
  });
  it("ids conservados (conjuntos vacíos): sin impacto, sin confirmación, sin bloqueo, ni con DIE", () => {
    for (const estado of [conAvance, { ...conAvance, die: { x: 1 }, veredicto: { v: 1 } }]) {
      expect(calcularImpactoReemplazoDVS(estado, edicion([], []))).toMatchObject({
        bloquear: false, requiereConfirmacion: false, hayImpactoF3: false,
      });
    }
  });
  it("id eliminado sin nada colgado en F3: sin confirmación (solo se confirma lo que F3 usa)", () => {
    expect(calcularImpactoReemplazoDVS(conAvance, edicion(["otra"]))).toMatchObject({
      requiereConfirmacion: false, hayImpactoF3: false,
    });
  });
  it("id eliminado con tarea con avance y resultado asociado: pide confirmación y cuenta lo afectado", () => {
    const base2 = base({
      tareas: [tarea("p1", [asig({ estado: "recibido", resultadoId: "r1" })]), tarea("p2")],
      resultados: [{ resultadoId: "r1", aprobado: true }, { resultadoId: "r2" }],
    });
    const d = calcularImpactoReemplazoDVS(base2, edicion(["p1"]));
    expect(d.requiereConfirmacion).toBe(true);
    expect(d.impacto).toMatchObject({ tareasAfectadas: 1, tareasConAvance: 1, resultadosRecibidos: 1, resultadosAprobados: 1 });
  });
  it("solo actores: la síntesis que guarda su FODA exige confirmación (criterio vigente: confirmar siempre que F3 use un id eliminado)", () => {
    const d = calcularImpactoReemplazoDVS(
      base({ sintesis: { fodaAdversariosInsumo: { x: {}, y: {} } } }),
      edicion([], ["x"])
    );
    expect(d.impacto).toMatchObject({ sintesisAfectada: true, sintesisPorActor: true, sintesisPorPregunta: false });
    expect(d.requiereConfirmacion).toBe(true);
  });
  it("síntesis con una pregunta eliminada en vaciosResiduales", () => {
    const d = calcularImpactoReemplazoDVS(base({ sintesis: { vaciosResiduales: [{ pipItemId: "p1" }] } }), edicion(["p1"]));
    expect(d.impacto).toMatchObject({ sintesisPorPregunta: true, sintesisPorActor: false });
  });
  it("DIE: bloquea SOLO si la edición elimina ids con impacto en F3; si conserva ids, continúa", () => {
    const conDie = { ...conAvance, die: { x: 1 } };
    expect(calcularImpactoReemplazoDVS(conDie, edicion(["p1"]))).toMatchObject({ bloquear: true, requiereConfirmacion: false });
    expect(calcularImpactoReemplazoDVS(conDie, edicion([], []))).toMatchObject({ bloquear: false });
    expect(calcularImpactoReemplazoDVS(conDie, edicion(["sin-nada-en-f3"]))).toMatchObject({ bloquear: false });
  });
  it("negativo — el comportamiento anterior de finalize-dvs (sin candado) nunca pide confirmación ni bloquea", () => {
    const antes = () => ({ bloquear: false, requiereConfirmacion: false });
    const conDie = { ...conAvance, die: { x: 1 } };
    const ahora = calcularImpactoReemplazoDVS(conDie, edicion(["p1"]));
    expect(antes()).not.toEqual({ bloquear: ahora.bloquear, requiereConfirmacion: ahora.requiereConfirmacion });
  });
});

describe("lineasDeImpactoEdicion", () => {
  it("D — con tareas con avance dice que «Sincronizar tablero ↺» las retirará junto con sus asignaciones y su avance", () => {
    const d = calcularImpactoReemplazoDVS(
      base({ tareas: [tarea("p1", [asig({ estado: "en_curso" })]), tarea("p2")] }),
      edicion(["p1", "p2"])
    );
    const l = lineasDeImpactoEdicion(d)[0];
    expect(l).toContain("2 tareas de «M1 · Tablero de tareas» (1 con avance) quedarán sin su pregunta");
    expect(l).toContain("«El PIP cambió desde que se generó el tablero de investigación»");
    expect(l).toContain("«Sincronizar tablero ↺» las retirará junto con sus asignaciones y su avance");
  });
  it("sin avance no promete avance que no hay", () => {
    const l = lineasDeImpactoEdicion(calcularImpactoReemplazoDVS(base({ tareas: [tarea("p1")] }), edicion(["p1"])))[0];
    expect(l).toContain("la retirará del tablero");
    expect(l).not.toContain("su avance");
  });
  it("actor eliminado: la síntesis conserva su FODA marcado como F3 ya lo muestra; pregunta eliminada: no se señala", () => {
    const porActor = lineasDeImpactoEdicion(
      calcularImpactoReemplazoDVS(base({ sintesis: { fodaAdversariosInsumo: { x: {} } } }), edicion([], ["x"]))
    ).join(" ");
    expect(porActor).toContain("conservará el insumo FODA de los actores eliminados");
    expect(porActor).toContain("«(ya no está en el Semáforo vigente)»");
    const porPregunta = lineasDeImpactoEdicion(
      calcularImpactoReemplazoDVS(base({ sintesis: { vaciosResiduales: [{ pipItemId: "p1" }] } }), edicion(["p1"]))
    ).join(" ");
    expect(porPregunta).toContain("seguirá citando preguntas que ya no existen");
    expect(porPregunta).toContain("F3 no lo señalará");
    expect(porPregunta).not.toContain("desactualizada");
  });
  it("vacío cuando no hay impacto real", () => {
    expect(lineasDeImpactoEdicion(calcularImpactoReemplazoDVS(base(), edicion([], [])))).toEqual([]);
  });
});

describe("motivoBloqueoDIE — verbo según la acción (E)", () => {
  it("«reemplazar» es exactamente MOTIVO_BLOQUEO_DIE (sin cambios para generate-dvs)", () => {
    expect(motivoBloqueoDIE("reemplazar")).toBe(MOTIVO_BLOQUEO_DIE);
    expect(MOTIVO_BLOQUEO_DIE).toContain("Reemplazar el análisis las dejaría inconsistentes");
  });
  it("«guardar» adapta el verbo y dice qué sí se puede guardar", () => {
    const m = motivoBloqueoDIE("guardar");
    expect(m).toContain("Guardar estos cambios las dejaría inconsistentes");
    expect(m).toContain("Puedes guardar cambios que conserven todas las preguntas y actores");
    expect(m).not.toContain("Reemplazar el análisis");
    expect(m).not.toMatch(/\bDIE\b/);
  });
  it("«finalizar» adapta el verbo", () => {
    expect(motivoBloqueoDIE("finalizar")).toContain("Finalizar este análisis las dejaría inconsistentes");
  });
});
