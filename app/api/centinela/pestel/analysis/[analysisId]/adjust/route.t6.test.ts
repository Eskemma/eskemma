// T6 — adjust: tope de 1 000 caracteres y retiro de la aprobación en UN update (con reintento seguro).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "TS", delete: () => "__DELETE__" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import { mensajeJustificacionLarga } from "@/lib/centinela/pestel/aprobacion";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const ctx = { params: Promise.resolve({ analysisId: "a1" }) };
const JUST = "Datos de campo muestran un riesgo mayor al estimado.";
const llamar = async (extra: Record<string, unknown> = {}) => {
  const r = await POST(
    new Request("http://local/x", {
      method: "POST",
      body: JSON.stringify({ dimensionCode: "P", newPosition: { x: 80, y: 70 }, newClassification: "AMENAZA", justification: JUST, ...extra }),
    }) as never,
    ctx
  );
  return { status: r.status, cuerpo: await r.json() };
};
const dims = [{ code: "P", classification: "NEUTRAL", intensity: "MEDIA", trend: "ESTABLE" }];
const aprobado = (extra: Record<string, unknown> = {}) => ({
  projectId: "p1", userId: "u1", status: "APPROVED", vigente: true, dimensions: dims, globalConfidence: 62,
  approvedAt: { _seconds: 1760000000 }, approvedBy: "u1", ...extra,
});
const sembrar = (analisis: Record<string, unknown>) => {
  db.reset({ "pestel_analyses/a1": analisis, "pestel_projects/p1": { userId: "u1", currentStage: 7 } });
  db.atomico(true);
};
const doc = async () => (await db.collection("pestel_analyses").doc("a1").get()).data() as Record<string, unknown>;
const escrituras = () => db.updates().filter((u) => u.path === "pestel_analyses/a1");

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("adjust — tope de la justificación", () => {
  it("1 000 caracteres (ya recortados) pasa; 1 001 da 400 con el texto fijo y no escribe", async () => {
    sembrar(aprobado({ status: "REVIEWED" }));
    expect((await llamar({ justification: "x".repeat(1000) })).status).toBe(200);
    sembrar(aprobado({ status: "REVIEWED" }));
    const r = await llamar({ justification: "x".repeat(1001) });
    expect(r.status).toBe(400);
    expect(r.cuerpo.error).toBe("La justificación no puede superar 1 000 caracteres (tiene 1001). Acórtala.");
    expect(r.cuerpo.error).toBe(mensajeJustificacionLarga(1001));
    expect(db.updates()).toEqual([]);
  });
  it("el recorte cuenta: 1 000 caracteres con espacios alrededor pasa", async () => {
    sembrar(aprobado({ status: "REVIEWED" }));
    expect((await llamar({ justification: `  ${"x".repeat(1000)}  ` })).status).toBe(200);
  });
  it("el mínimo de 20 sigue igual", async () => {
    sembrar(aprobado({ status: "REVIEWED" }));
    expect((await llamar({ justification: "x".repeat(19) })).cuerpo.error).toBe("La justificación debe tener al menos 20 caracteres.");
  });
  it("los ajustes EXISTENTES (hasta 131 caracteres en datos reales, y aun uno de 5 000) se leen y se conservan intactos: el tope solo aplica al escribir", async () => {
    const largo = "y".repeat(5000);
    sembrar(
      aprobado({
        status: "REVIEWED",
        adjustments: [
          { dimensionCode: "E", justification: "z".repeat(131) },
          { dimensionCode: "S", justification: largo },
        ],
      })
    );
    expect((await llamar()).status).toBe(200);
    const lista = (await doc()).adjustments as { dimensionCode: string; justification: string }[];
    expect(lista.find((a) => a.dimensionCode === "E")!.justification).toHaveLength(131);
    expect(lista.find((a) => a.dimensionCode === "S")!.justification).toBe(largo);
    expect(lista.find((a) => a.dimensionCode === "P")!.justification).toBe(JUST);
  });
});

describe("adjust — retiro de la aprobación (D4)", () => {
  it("sobre un APPROVED: UN solo update con el ajuste, status REVIEWED, la aprobación archivada y approvedAt/By borrados", async () => {
    sembrar(aprobado({ aprobacionJustificacion: "porque sí, tras revisar", aprobacionConfianza: 62 }));
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ ok: true, status: "REVIEWED", aprobacionRetirada: true, vigente: true });
    const w = escrituras();
    expect(w).toHaveLength(1); // copiar y borrar son campos de UN mismo update: atómico
    expect(w[0].data).toMatchObject({
      status: "REVIEWED",
      approvedAt: "__DELETE__",
      approvedBy: "__DELETE__",
      aprobacionJustificacion: "__DELETE__",
      aprobacionConfianza: "__DELETE__",
      aprobacionAnterior: { approvedAt: { _seconds: 1760000000 }, approvedBy: "u1", justificacion: "porque sí, tras revisar", confianza: 62 },
      aprobacionRetirada: { en: "TS", porDimension: "P", ajustadoPor: "u1" },
    });
    // (el fixture no procesa FieldValue.delete: el borrado se comprueba en el payload de arriba)
    expect((await doc()).dimensions).toEqual(dims);
  });
  it("sin justificación ni confianza archivadas: aprobacionAnterior no lleva esas claves (Firestore no admite undefined)", async () => {
    sembrar(aprobado());
    await llamar();
    expect(escrituras()[0].data.aprobacionAnterior).toEqual({ approvedAt: { _seconds: 1760000000 }, approvedBy: "u1" });
  });
  it("no toca la etapa del proyecto", async () => {
    sembrar(aprobado());
    await llamar();
    expect(db.updates().filter((u) => u.path === "pestel_projects/p1")).toEqual([]);
  });
  it("sobre un REVIEWED o PENDING no retira nada (mismas claves de siempre) y responde aprobacionRetirada:false", async () => {
    for (const status of ["REVIEWED", "PENDING_REVIEW"]) {
      sembrar(aprobado({ status }));
      const r = await llamar();
      expect(r.cuerpo).toMatchObject({ status, aprobacionRetirada: false });
      expect(Object.keys(escrituras()[0].data).sort()).toEqual(["adjustments", "updatedAt"]);
    }
  });
  it("informa si el análisis ya no es el vigente (avisar, no bloquear): guarda igual", async () => {
    sembrar(aprobado({ status: "REVIEWED", vigente: false }));
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(r.cuerpo.vigente).toBe(false);
  });
  it("si falla la escritura no queda nada a medias (todo o nada)", async () => {
    sembrar(aprobado());
    db.failUpdateOn("pestel_analyses/a1");
    await expect(llamar()).rejects.toThrow();
    const d = await doc();
    expect(d.status).toBe("APPROVED");
    expect(d.approvedBy).toBe("u1");
    expect(d).not.toHaveProperty("aprobacionAnterior");
  });
});

describe("adjust — reintento de la transacción", () => {
  it("el callback se reejecuta: relee el documento y la aprobación se archiva UNA vez", async () => {
    sembrar(aprobado());
    const original = db.runTransaction.bind(db);
    // Primer intento: se ejecuta el callback pero sus escrituras se descartan (como un intento reintentado).
    vi.spyOn(db, "runTransaction").mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
      await original(async (tx: Record<string, unknown>) => cb({ ...tx, update: () => {} }));
      return original(cb as never);
    }) as never);
    await llamar();
    const d = await doc();
    expect(d.status).toBe("REVIEWED");
    expect(d.aprobacionAnterior).toEqual({ approvedAt: { _seconds: 1760000000 }, approvedBy: "u1" });
  });
  it("si entre intentos otra petición ya retiró la aprobación, el reintento NO la vuelve a copiar ni pisa aprobacionAnterior", async () => {
    sembrar(aprobado());
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
      await original(async (tx: Record<string, unknown>) => cb({ ...tx, update: () => {} }));
      // la otra petición gana la carrera
      await db.collection("pestel_analyses").doc("a1").update({
        status: "REVIEWED",
        aprobacionAnterior: { approvedAt: { _seconds: 1760000000 }, approvedBy: "u1", marca: "de-la-otra-peticion" },
        approvedAt: "__DELETE__",
      });
      return original(cb as never);
    }) as never);
    const r = await llamar();
    expect(r.cuerpo).toMatchObject({ status: "REVIEWED", aprobacionRetirada: false });
    expect((await doc()).aprobacionAnterior).toMatchObject({ marca: "de-la-otra-peticion" });
  });
  it("un reintento del CLIENTE tras perder la respuesta (ya REVIEWED) no vuelve a retirar y devuelve el status real", async () => {
    sembrar(aprobado());
    await llamar();
    const anterior = (await doc()).aprobacionAnterior;
    const r = await llamar({ justification: "Segundo ajuste de la misma dimensión, ya sin aprobación." });
    expect(r.cuerpo).toMatchObject({ status: "REVIEWED", aprobacionRetirada: false });
    expect((await doc()).aprobacionAnterior).toEqual(anterior);
  });
});

describe("adjust — propiedad por proyecto", () => {
  it("404 si el proyecto es de otro usuario aunque la copia userId del análisis diga lo contrario; sin escrituras", async () => {
    db.reset({
      "pestel_analyses/a1": aprobado({ userId: "u1" }),
      "pestel_projects/p1": { userId: "otro" },
    });
    expect(await llamar()).toEqual({ status: 404, cuerpo: { error: "Análisis no encontrado" } });
    expect(db.updates()).toEqual([]);
  });
});
