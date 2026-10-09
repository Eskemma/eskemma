import { describe, expect, it, vi } from "vitest";

// project.ts imports firebase-admin; only the pure normalizer is used here.
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {}, adminAuth: {}, adminStorage: {} }));

import { diffIdsDVS, resumenEliminados } from "./diffIdsDVS";
import { normalizeTareaPIP } from "./project";
import { tareaTieneProgreso } from "./impactoReemplazoDVS";

const pip = (id: string, pregunta = `¿${id}?`, numero = 1) => ({ pipItemId: id, numero, pregunta });
const actor = (id: string, nombre = `Actor ${id}`) => ({ actorId: id, nombre });
const dvs = (p: unknown[], a: unknown[] = []) => ({ pip: p, semaforo: a }) as never;

describe("diffIdsDVS", () => {
  it("sin dvs anterior (primera finalización): nada eliminado", () => {
    expect(diffIdsDVS(null, dvs([pip("a")]))).toEqual({ pip: [], actores: [] });
    expect(diffIdsDVS(undefined, dvs([pip("a")]))).toEqual({ pip: [], actores: [] });
  });

  it("ids conservados con el texto editado y reordenados: nada eliminado", () => {
    const antes = dvs([pip("a", "vieja", 1), pip("b", "otra", 2)], [actor("x"), actor("y")]);
    const despues = dvs([pip("b", "otra editada", 1), pip("a", "vieja editada", 2)], [actor("y", "Renombrado"), actor("x")]);
    expect(diffIdsDVS(antes, despues)).toEqual({ pip: [], actores: [] });
  });

  it("quitar una pregunta y un actor: devuelve el id con su texto del dvs ANTERIOR", () => {
    const antes = dvs([pip("a", "¿Quién vota?"), pip("b")], [actor("x", "Gobernador"), actor("y")]);
    const despues = dvs([pip("b")], [actor("y")]);
    expect(diffIdsDVS(antes, despues)).toEqual({
      pip: [{ id: "a", pregunta: "¿Quién vota?" }],
      actores: [{ id: "x", nombre: "Gobernador" }],
    });
  });

  it("añadir y quitar a la vez: solo cuentan los eliminados", () => {
    const antes = dvs([pip("a"), pip("b")]);
    const despues = dvs([pip("b"), pip("nuevo")]);
    expect(diffIdsDVS(antes, despues).pip.map((p) => p.id)).toEqual(["a"]);
  });

  it("borrador regenerado (todos los ids nuevos): todos los anteriores quedan eliminados", () => {
    const antes = dvs([pip("a"), pip("b")], [actor("x")]);
    const despues = dvs([pip("n1"), pip("n2")], [actor("n3")]);
    const d = diffIdsDVS(antes, despues);
    expect(d.pip.map((p) => p.id)).toEqual(["a", "b"]);
    expect(d.actores.map((a) => a.id)).toEqual(["x"]);
  });

  it("ids duplicados: un id repetido en el nuevo cuenta como presente; uno repetido en el anterior se lista una vez", () => {
    const antes = dvs([pip("a", "primera"), pip("a", "segunda")]);
    expect(diffIdsDVS(antes, dvs([pip("a")])).pip).toEqual([]);
    expect(diffIdsDVS(antes, dvs([])).pip).toEqual([{ id: "a", pregunta: "primera" }]);
  });

  it("proyecto legado sin ids: ambos lados se normalizan igual (legacy-N / legacy-nombre), sin eliminados falsos", () => {
    const sinIds = () => ({
      pip: [{ numero: 1, pregunta: "p1" }, { numero: 2, pregunta: "p2" }],
      semaforo: [{ nombre: "Alcalde" }],
    }) as never;
    expect(diffIdsDVS(sinIds(), sinIds())).toEqual({ pip: [], actores: [] });
    // El anterior ya con `legacy-N` estampado (getProject / finalize-dvs) y el nuevo sin id: tampoco difieren.
    const estampado = { pip: [{ pipItemId: "legacy-1", numero: 1, pregunta: "p1" }], semaforo: [{ actorId: "legacy-Alcalde", nombre: "Alcalde" }] } as never;
    const crudo = { pip: [{ numero: 1, pregunta: "p1" }], semaforo: [{ nombre: "Alcalde" }] } as never;
    expect(diffIdsDVS(estampado, crudo)).toEqual({ pip: [], actores: [] });
    expect(diffIdsDVS(crudo, estampado)).toEqual({ pip: [], actores: [] });
    // Quitar la pregunta 2 de un legado sí la reporta, con el mismo id que usa el tablero legado.
    expect(diffIdsDVS(sinIds(), { pip: [{ numero: 1, pregunta: "p1" }], semaforo: [{ nombre: "Alcalde" }] } as never).pip).toEqual([
      { id: "legacy-2", pregunta: "p2" },
    ]);
  });

  it("dvs con pip/semaforo ausentes no lanza", () => {
    expect(diffIdsDVS({} as never, {} as never)).toEqual({ pip: [], actores: [] });
    expect(diffIdsDVS(dvs([pip("a")]), {} as never).pip).toHaveLength(1);
  });
});

describe("resumenEliminados", () => {
  it("lista máx. 5 de cada tipo, cuenta el total y recorta el texto a 80 caracteres", () => {
    const e = {
      pip: Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, pregunta: i === 0 ? "x".repeat(200) : `pregunta ${i}` })),
      actores: [{ id: "a", nombre: "  " }],
    };
    const r = resumenEliminados(e);
    expect(r.totalPreguntas).toBe(7);
    expect(r.preguntas).toHaveLength(5);
    expect(r.preguntas[0].length).toBeLessThanOrEqual(80);
    expect(r.preguntas[0].endsWith("…")).toBe(true);
    expect(r.actores).toEqual(["(actor sin nombre)"]);
  });
});

describe("JSON de siembra de la guía de navegador (commit 3)", () => {
  // Exactamente lo que se pega en phases.investigacion.f3TareasPIP de un proyecto desechable.
  const siembra = JSON.parse(
    '[{"pipItemId":"ID_DE_UNA_PREGUNTA","asignaciones":[{"asignacionId":"1-0","tipo":"primaria","canal":"canal2","justificacion":"prueba","estado":"en_curso","activada":true}]}]'
  );
  it("pasa por normalizeTareaPIP sin cambios y cuenta como avance real", () => {
    const t = normalizeTareaPIP(siembra[0]);
    expect(t.pipItemId).toBe("ID_DE_UNA_PREGUNTA");
    expect(t.asignaciones).toHaveLength(1);
    expect(t.asignaciones[0]).toMatchObject({ estado: "en_curso", activada: true, canal: "canal2" });
    expect(tareaTieneProgreso(t)).toBe(true);
  });
  it("una asignación «pendiente» y activada NO cuenta como avance (control)", () => {
    const t = normalizeTareaPIP({ ...siembra[0], asignaciones: [{ ...siembra[0].asignaciones[0], estado: "pendiente" }] });
    expect(tareaTieneProgreso(t)).toBe(false);
  });
});
