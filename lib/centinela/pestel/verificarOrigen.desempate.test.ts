// T7 C5 — verificarOrigen: ¿cuál es «el» vigente cuando la consulta devuelve varios? Antes: `docs[0]` (el orden de Firestore,
// arbitrario). Ahora: el de `analyzedAt` más reciente (`elegirUltimoAnalisis`, la misma regla de link-moddulo y E5).
import { describe, expect, it } from "vitest";
import { verificarOrigen } from "./verificarOrigen";
import { huellaDeOrigen } from "./huellaOrigen";
import { AJUSTES_EJEMPLO, DIMENSIONES_EJEMPLO } from "./__fixtures__/analisisEjemplo";

type Vig = { id: string; version?: number; analyzedAt?: string };
function falsoDb(vigentes: Vig[]) {
  const docs: Record<string, Record<string, any>> = {
    "moddulo_projects/m1": {
      collaborators: [{ uid: "u1" }],
      phases: { exploracion: { linkedSource: { kind: "T22", sourceId: "pest1", sourceAnalysisId: "a1", huellaFuente: huellaDeOrigen(DIMENSIONES_EJEMPLO as never, AJUSTES_EJEMPLO as never) } } },
    },
    "pestel_analyses/a1": { projectId: "pest1", dimensions: DIMENSIONES_EJEMPLO, adjustments: AJUSTES_EJEMPLO, version: 1, analyzedAt: "2026-10-01T00:00:00.000Z" },
  };
  return {
    collection: (c: string) => ({
      doc: (id: string) => ({ path: `${c}/${id}` }),
      where: () => ({ where: () => ({ select: () => ({ get: async () => ({ docs: vigentes.map((v) => ({ id: v.id, data: () => ({ version: v.version, analyzedAt: v.analyzedAt }) })) }) }) }) }),
    }),
    getAll: async (r: { path: string }) => [{ exists: docs[r.path] !== undefined, data: () => docs[r.path] }],
  } as never;
}
const P = { uid: "u1", pestelProjectId: "pest1", pestelUserId: "u1", modduloProjectId: "m1" };
const OCT9 = "2026-10-09T00:00:00.000Z", OCT20 = "2026-10-20T00:00:00.000Z";

describe("verificarOrigen — desempate entre varios vigentes", () => {
  it("un solo vigente: es ese", async () => {
    const r = await verificarOrigen(falsoDb([{ id: "a2", version: 2, analyzedAt: OCT9 }]), P);
    expect(r).toMatchObject({ estado: "version_nueva", vigente: { version: 2 } });
  });
  it("ningún vigente: no hay «versión nueva» (cae a comparar la huella)", async () => {
    expect((await verificarOrigen(falsoDb([]), P)).estado).toBe("igual");
  });
  it("DOS vigentes con el orden invertido (la más vieja primero): gana la de `analyzedAt` más reciente", async () => {
    const r = await verificarOrigen(falsoDb([{ id: "vieja", version: 2, analyzedAt: OCT9 }, { id: "nueva", version: 7, analyzedAt: OCT20 }]), P);
    expect(r).toMatchObject({ estado: "version_nueva", vigente: { version: 7, fecha: OCT20 } });
  });
  it("empate de fecha: gana el primero (orden estable)", async () => {
    const r = await verificarOrigen(falsoDb([{ id: "x", version: 3, analyzedAt: OCT20 }, { id: "y", version: 4, analyzedAt: OCT20 }]), P);
    expect(r).toMatchObject({ estado: "version_nueva", vigente: { version: 3 } });
  });
  it("`analyzedAt` ausente en todos: conserva el primero y no avisa de versión nueva (no se puede comparar fechas)", async () => {
    const r = await verificarOrigen(falsoDb([{ id: "x", version: 3 }, { id: "y", version: 4 }]), P);
    expect(r.estado).toBe("igual");
  });
});
