// T4: verificarOrigen — datos mínimos, lecturas contadas y nada que filtrar si el origen no es del usuario.
import { describe, expect, it, vi } from "vitest";
import { verificarOrigen } from "./verificarOrigen";
import { huellaDeOrigen } from "./huellaOrigen";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "./__fixtures__/analisisEjemplo";

type Doc = Record<string, any> | undefined;
/** db falso que cuenta documentos leídos (getAll + consulta). */
function falsoDb(docs: Record<string, Doc>, vigentes: Array<{ id: string; version: number; analyzedAt: string }>) {
  let lecturas = 0;
  const llamadas = { getAll: [] as unknown[], select: [] as unknown[] };
  const ref = (path: string) => ({ path });
  const db = {
    collection: (c: string) => ({
      doc: (id: string) => ref(`${c}/${id}`),
      where: () => ({
        where: () => ({
          select: (...campos: string[]) => {
            llamadas.select.push(campos);
            return { get: async () => { lecturas += vigentes.length; return { docs: vigentes.map((v) => ({ id: v.id, data: () => ({ version: v.version, analyzedAt: v.analyzedAt }) })) }; } };
          },
        }),
      }),
    }),
    getAll: vi.fn(async (r: { path: string }, opts: unknown) => {
      llamadas.getAll.push(opts);
      lecturas += 1;
      const d = docs[r.path];
      return [{ exists: d !== undefined, data: () => d }];
    }),
  };
  return { db: db as never, lecturas: () => lecturas, llamadas };
}

const HUELLA = huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never);
const mod = (extra: Record<string, unknown> = {}) => ({
  collaborators: [{ uid: "u1" }],
  phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", huellaFuente: HUELLA, ...extra } } },
});
const analisis = (extra: Record<string, unknown> = {}) => ({ projectId: "pest1", dimensions: DIMENSIONES_EJEMPLO, adjustments: AJUSTES_EJEMPLO, version: 1, analyzedAt: "2026-10-01T00:00:00.000Z", ...extra });
const P = { uid: "u1", pestelProjectId: "pest1", pestelUserId: "u1", modduloProjectId: "m1" };
const vig1 = [{ id: "a1", version: 1, analyzedAt: "2026-10-01T00:00:00.000Z" }];

describe("verificarOrigen", () => {
  it("camino normal: 3 lecturas (Moddulo + análisis importado + 1 vigente), con máscaras de campos y sin pedir `informes`", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod(), "pestel_analyses/a1": analisis() }, vig1);
    const r = await verificarOrigen(f.db, P);
    expect(r.estado).toBe("igual");
    expect(f.lecturas()).toBe(3);
    const masks = (f.llamadas.getAll as Array<{ fieldMask: string[] }>).map((o) => o.fieldMask.join(" "));
    expect(masks.join(" ")).not.toContain("informes");
    // T7 C3: la nota se calcula con los MISMOS campos leídos (status, confianza, justificación, fecha): 0 lecturas extra.
    expect(masks[1]).toBe("projectId dimensions adjustments version analyzedAt status globalConfidence aprobacionJustificacion approvedAt");
    expect(f.llamadas.select).toEqual([["version", "analyzedAt"]]);
  });

  it("versión más nueva", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod(), "pestel_analyses/a1": analisis() }, [{ id: "a2", version: 2, analyzedAt: "2026-10-09T00:00:00.000Z" }]);
    expect((await verificarOrigen(f.db, P)).estado).toBe("version_nueva");
  });

  it("el análisis cambió de contenido (se agregó un ajuste)", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod(), "pestel_analyses/a1": analisis({ adjustments: [] }) }, vig1);
    expect((await verificarOrigen(f.db, P)).estado).toBe("cambio_contenido");
  });

  it("importación sin huella → no_verificable", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod({ huellaFuente: undefined }), "pestel_analyses/a1": analisis() }, vig1);
    expect(await verificarOrigen(f.db, P)).toMatchObject({ estado: "no_verificable", razon: "sin_huella" });
  });

  it("el PESTEL de origen NO es del usuario: no_verificable, sin leer nada y sin id, versión ni fecha", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod(), "pestel_analyses/a1": analisis() }, [{ id: "a2", version: 9, analyzedAt: "2030-01-01T00:00:00.000Z" }]);
    const r = await verificarOrigen(f.db, { ...P, pestelUserId: "otro" });
    expect(r).toEqual({ estado: "no_verificable", razon: "origen_ajeno" });
    expect(f.lecturas()).toBe(0);
  });

  it("el análisis importado pertenece a OTRO proyecto PESTEL: no_verificable sin filtrar datos del otro", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod(), "pestel_analyses/a1": analisis({ projectId: "ajeno" }) }, [{ id: "a2", version: 9, analyzedAt: "2030-01-01T00:00:00.000Z" }]);
    const r = await verificarOrigen(f.db, P);
    expect(r).toEqual({ estado: "no_verificable", razon: "origen_otro_proyecto" });
    expect(JSON.stringify(r)).not.toMatch(/a2|2030|ajeno/);
  });

  it.each([
    ["no es colaborador", { ...mod(), collaborators: [{ uid: "otro" }] }],
    ["está en la papelera", { ...mod(), deletedAt: "2026-10-01" }],
    ["no es T22", mod({ kind: "express" })],
    ["apunta a otro PESTEL", mod({ sourceId: "otro" })],
    ["no tiene análisis importado", mod({ sourceAnalysisId: undefined })],
  ])("el Moddulo %s: no_verificable sin leer el análisis", async (_n, m) => {
    const f = falsoDb({ "moddulo_projects/m1": m as never, "pestel_analyses/a1": analisis() }, vig1);
    expect(await verificarOrigen(f.db, P)).toEqual({ estado: "no_verificable", razon: "sin_vinculo" });
    expect(f.lecturas()).toBe(1);
  });

  it("el análisis importado ya no existe → no_verificable", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod() }, vig1);
    expect(await verificarOrigen(f.db, P)).toEqual({ estado: "no_verificable", razon: "origen_no_disponible" });
  });
});

describe("verificarOrigen — nota de aprobación (T7 C3)", () => {
  const V1_LITERAL = { v: 1, h: "e231635ea703d9ff82e7f6ef44233b41cfb0720852fd3b81d76685977c86cfb0" };
  const NOTA = { confianza: 39, justificacion: "Se aprueba con reservas documentadas." };
  const APROBADO_39 = { status: "APPROVED", globalConfidence: 39, aprobacionJustificacion: NOTA.justificacion, approvedAt: "2026-10-20T00:00:00.000Z" };
  const h2 = (nota: object | null) => huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never, { nota: nota as never });
  const estado = async (linked: Record<string, unknown>, an: Record<string, unknown>) =>
    (await verificarOrigen(falsoDb({ "moddulo_projects/m1": mod(linked), "pestel_analyses/a1": analisis(an) }, vig1).db, P)).estado;

  it("los T22 reales con huella v1 (hash literal de T4) se comparan con la regla v1: «igual», aunque el análisis ahora esté APROBADO con confianza 39 y justificación (la nota no los toca)", async () => {
    expect(await estado({ huellaFuente: V1_LITERAL }, APROBADO_39)).toBe("igual");
    expect(await estado({ huellaFuente: V1_LITERAL }, { ...APROBADO_39, aprobacionJustificacion: "Otra distinta, ya aprobada de nuevo." })).toBe("igual");
    expect(await estado({ huellaFuente: V1_LITERAL }, { status: "REVIEWED", globalConfidence: 39 })).toBe("igual");
  });
  it("v1 sigue detectando un cambio de CONTENIDO (como en T4)", async () => {
    expect(await estado({ huellaFuente: V1_LITERAL }, { adjustments: [] })).toBe("cambio_contenido");
  });
  it("v2 con la nota importada igual a la actual → igual", async () => {
    expect(await estado({ huellaFuente: h2(NOTA), aprobacionOrigen: NOTA }, APROBADO_39)).toBe("igual");
  });
  it("v2 importado SIN nota y el analista aprueba después con confianza baja → cambio_nota (la acción real: «Finalizar interpretación»)", async () => {
    expect(await estado({ huellaFuente: h2(null) }, APROBADO_39)).toBe("cambio_nota");
  });
  it("v2 con nota y se vuelve a aprobar con OTRA justificación → cambio_nota", async () => {
    expect(await estado({ huellaFuente: h2(NOTA), aprobacionOrigen: NOTA }, { ...APROBADO_39, aprobacionJustificacion: "Otra justificación distinta." })).toBe("cambio_nota");
  });
  it("v2 con nota y la aprobación se retira SIN tocar el contenido → cambio_nota (la nota se retiró)", async () => {
    expect(await estado({ huellaFuente: h2(NOTA), aprobacionOrigen: NOTA }, { status: "REVIEWED", globalConfidence: 39 })).toBe("cambio_nota");
  });
  it("v2 con nota y un ajuste (que retira la aprobación Y cambia el contenido) → cambio_contenido, no cambio_nota", async () => {
    expect(await estado({ huellaFuente: h2(NOTA), aprobacionOrigen: NOTA }, { status: "REVIEWED", globalConfidence: 39, adjustments: [] })).toBe("cambio_contenido");
  });
  it("sin huella (importación previa a T4) sigue siendo no_verificable, con o sin nota en el análisis", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod({ huellaFuente: undefined }), "pestel_analyses/a1": analisis(APROBADO_39) }, vig1);
    expect(await verificarOrigen(f.db, P)).toMatchObject({ estado: "no_verificable", razon: "sin_huella" });
  });
  it("lecturas: las mismas 3 de siempre (la nota sale de los campos que ya se leen)", async () => {
    const f = falsoDb({ "moddulo_projects/m1": mod({ huellaFuente: h2(null) }), "pestel_analyses/a1": analisis(APROBADO_39) }, vig1);
    await verificarOrigen(f.db, P);
    expect(f.lecturas()).toBe(3);
  });
});
