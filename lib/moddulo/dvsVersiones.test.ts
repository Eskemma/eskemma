import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { reemplazarDVSConVersion } from "./dvsVersiones";
import type { DVSF2 } from "@/types/moddulo.types";
import type { Firestore } from "firebase-admin/firestore";

const db = createMockAdminDb();
const asDb = db as unknown as Firestore;
const P = "moddulo_projects/p1";

const dvsA = { hei: { tensionCentral: "A", contexto: "x" }, contrasteXPCTO: [], semaforo: [], incertidumbres: [], pip: [{ pipItemId: "1", pregunta: "q" }] } as unknown as DVSF2;
const dvsB = { ...dvsA, hei: { tensionCentral: "B", contexto: "x" } } as unknown as DVSF2;
const updates = { "phases.exploracion.estado": "lista", updatedAt: "SERVER_TIMESTAMP" };

const versiones = () =>
  Object.entries(db.snapshot()).filter(([path]) => path.startsWith(`${P}/dvsVersiones/`));

beforeEach(() => db.reset());

describe("reemplazarDVSConVersion", () => {
  it("primera finalización (sin dvs previo): escribe el dvs y NO crea copia", async () => {
    db.reset({ [P]: { phases: { exploracion: {} } } });
    const r = await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsA, updates, origen: "finalize-dvs", uid: "u1" });
    expect(r.versionId).toBeNull();
    expect(versiones()).toHaveLength(0);
    expect(db.updates()[0].data["phases.exploracion.dvs"]).toEqual(dvsA);
    expect(db.updates()[0].data["phases.exploracion.estado"]).toBe("lista");
  });

  it("dvs distinto: guarda el anterior con fecha, uid y origen, y aplica el nuevo", async () => {
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    const r = await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "generate-dvs-final", uid: "uOwner" });
    expect(r.versionId).toBeTruthy();
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0][1]).toEqual({ dvs: dvsA, reemplazadoEn: "SERVER_TIMESTAMP", reemplazadoPor: "uOwner", origen: "generate-dvs-final" });
    expect(db.updates()[0].data["phases.exploracion.dvs"]).toEqual(dvsB);
  });

  it("dvs idéntico (aunque cambie el orden de las claves): NO crea copia, pero sí aplica los updates", async () => {
    const reordenado = { pip: dvsA.pip, incertidumbres: [], semaforo: [], contrasteXPCTO: [], hei: { contexto: "x", tensionCentral: "A" } } as unknown as DVSF2;
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    const r = await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: reordenado, updates, origen: "finalize-dvs", uid: "u1" });
    expect(r.versionId).toBeNull();
    expect(versiones()).toHaveLength(0);
    expect(db.updates()).toHaveLength(1);
  });

  it("guardar sin cambios dos veces seguidas no acumula copias", async () => {
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "finalize-dvs", uid: "u1" });
    // El mock aplica el update con la clave literal, así que sembramos el estado resultante.
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsB } } }, ...Object.fromEntries(versiones()) });
    await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "finalize-dvs", uid: "u1" });
    expect(versiones()).toHaveLength(1);
  });

  it("proyecto inexistente: lanza y no escribe nada", async () => {
    await expect(
      reemplazarDVSConVersion(asDb, "nope", { nuevoDvs: dvsA, updates, origen: "finalize-dvs", uid: "u1" })
    ).rejects.toThrow("Proyecto no encontrado");
    expect(db.updates()).toHaveLength(0);
  });

  it("si la copia falla, el reemplazo se ABORTA: el dvs nuevo nunca se aplica", async () => {
    const update = vi.fn();
    const dbFalla = {
      collection: () => ({
        doc: () => ({
          id: "p1",
          collection: () => ({ doc: () => ({ id: "v1" }) }),
        }),
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: async () => ({ exists: true, data: () => ({ phases: { exploracion: { dvs: dvsA } } }) }),
          set: () => { throw new Error("falla al escribir la copia"); },
          update,
        }),
    } as unknown as Firestore;
    await expect(
      reemplazarDVSConVersion(dbFalla, "p1", { nuevoDvs: dvsB, updates, origen: "generate-dvs-final", uid: "u1" })
    ).rejects.toThrow("falla al escribir la copia");
    expect(update).not.toHaveBeenCalled();
  });

  it("negativo — el comportamiento anterior (update directo) sobrescribía sin dejar copia", async () => {
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    const ref = db.collection("moddulo_projects").doc("p1");
    await ref.update({ "phases.exploracion.dvs": dvsB, ...updates });
    expect(versiones()).toHaveLength(0); // el dvs anterior se perdía
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "generate-dvs-final", uid: "u1" });
    expect(versiones()).toHaveLength(1); // ahora se conserva
  });
});

// ── commit 2: guardia transaccional ──────────────────────────────────────────

import { ReemplazoRechazadoError, type DecisionReemplazo } from "./impactoReemplazoDVS";

describe("reemplazarDVSConVersion — guardia", () => {
  const rechazo = () => new ReemplazoRechazadoError("huella_vencida", {} as DecisionReemplazo);

  it("la guardia recibe el documento crudo y los f3Resultados leídos DENTRO de la transacción", async () => {
    db.reset({
      [P]: { phases: { exploracion: { dvs: dvsA } } },
      [`${P}/f3Resultados/r1`]: { aprobado: true },
      [`${P}/f3Resultados/r2`]: { aprobado: false },
    });
    const guardia = vi.fn();
    await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "generate-dvs-final", uid: "u1", guardia });
    expect(guardia).toHaveBeenCalledOnce();
    const lectura = guardia.mock.calls[0][0];
    expect(lectura.proyecto).toMatchObject({ phases: { exploracion: { dvs: dvsA } } });
    expect(lectura.resultados.map((r: { id: string }) => r.id).sort()).toEqual(["r1", "r2"]);
    expect(lectura.resultados.find((r: { id: string }) => r.id === "r1").data).toEqual({ aprobado: true });
  });

  it("si la guardia lanza: no se copia ni se escribe nada y el error sale tal cual", async () => {
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } } });
    await expect(
      reemplazarDVSConVersion(asDb, "p1", {
        nuevoDvs: dvsB, updates, origen: "generate-dvs-final", uid: "u1",
        guardia: () => { throw rechazo(); },
      })
    ).rejects.toBeInstanceOf(ReemplazoRechazadoError);
    expect(versiones()).toHaveLength(0);
    expect(db.updates()).toHaveLength(0);
  });

  it("sin guardia (finalize-dvs, commit 1) se comporta igual que antes: copia y reemplaza", async () => {
    db.reset({ [P]: { phases: { exploracion: { dvs: dvsA } } }, [`${P}/f3Resultados/r1`]: {} });
    const r = await reemplazarDVSConVersion(asDb, "p1", { nuevoDvs: dvsB, updates, origen: "finalize-dvs", uid: "u1" });
    expect(r.versionId).toBeTruthy();
    expect(versiones()).toHaveLength(1);
  });
});
