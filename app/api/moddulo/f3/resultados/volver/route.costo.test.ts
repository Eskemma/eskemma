// C4b-1b — COSTO de «volver», medido con los contadores del mock (lecturas y escrituras de documentos; no son las de
// Firestore real). Estimaciones del plan: pregunta ≈ 5 L; volver con historial vigente ≈ 5 L y ≈ 6 E; 404/400/403 ≤ 1 L.
// `getProject` suma +1 lectura y +1 escritura (`lastAccessedAt`, H-V23) en todo lo que pasa de la validación del cuerpo.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb, createMockAdminStorage } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb(), adminStorage: createMockAdminStorage([]) };
});
vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const orig = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...orig, FieldValue: { delete: () => "__DELETE__", serverTimestamp: () => orig.Timestamp.fromDate(new Date(Date.UTC(2026, 10, 25, 9, 0, 0))) } };
});
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));

import { adminDb } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";
import { consolidarSemilla } from "@/lib/moddulo/__tests__/fixtures/siembraHistorialF3";
import { ID_LEGADO, PID, PROYECTO, RESULTADO, RID, V1, asig, sembrarVolver } from "@/lib/moddulo/__tests__/fixtures/siembraVolver";
import { POST } from "./route";

const db = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const cuerpo = (extra: Record<string, unknown> = {}) => ({ projectId: PID, resultadoId: RID, versionId: V1, ...extra });
const pedir = (b: unknown = cuerpo()) => POST(new Request("http://local/x", { method: "POST", body: JSON.stringify(b) }) as never);
const sesion = (uid = "u1") => vi.mocked(getSessionFromRequest).mockResolvedValue({ uid } as never);

/** Mide UNA llamada: reinicia contadores (sin cambiar datos) y devuelve lo gastado. */
async function medir(b: unknown) {
  consolidarSemilla(db, PROYECTO);
  const r = await pedir(b);
  const { lecturas, escrituras, borrados } = db.contadores();
  return { status: r.status, cuerpo: await r.json(), lecturas, escrituras, borrados };
}

beforeEach(() => {
  vi.clearAllMocks();
  sesion();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("errores baratos: ≤ 1 lectura", () => {
  it("400 y 401: 0 lecturas y 0 escrituras", async () => {
    await sembrarVolver(db);
    expect(await medir("no es json")).toMatchObject({ status: 400, lecturas: 0, escrituras: 0 });
    expect(await medir(cuerpo({ resultadoId: "a/b" }))).toMatchObject({ status: 400, lecturas: 0, escrituras: 0 });
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect(await medir(cuerpo())).toMatchObject({ status: 401, lecturas: 0, escrituras: 0 });
  });
  it("404 de proyecto (ajeno o inexistente): 1 lectura y 0 escrituras", async () => {
    await sembrarVolver(db);
    sesion("ajeno");
    expect(await medir(cuerpo())).toMatchObject({ status: 404, lecturas: 1, escrituras: 0 });
    sesion();
    expect(await medir(cuerpo({ projectId: "no-existe" }))).toMatchObject({ status: 404, lecturas: 1, escrituras: 0 });
  });
  it("403 (analyst/client): 1 lectura y la única escritura es `lastAccessedAt` de getProject", async () => {
    await sembrarVolver(db);
    sesion("u3");
    expect(await medir(cuerpo())).toMatchObject({ status: 403, lecturas: 1, escrituras: 1 });
    sesion("u4");
    expect(await medir(cuerpo())).toMatchObject({ status: 403, lecturas: 1, escrituras: 1 });
  });
});

describe("pregunta y decisiones de la transacción (0 escrituras propias)", () => {
  it("PREGUNTA: 5 lecturas (getProject + resultado + proyecto + manifiesto + versión) — la estimación del plan — y 1 escritura (lastAccessedAt)", async () => {
    await sembrarVolver(db);
    const m = await medir(cuerpo());
    expect(m).toMatchObject({ status: 409, lecturas: 5, escrituras: 1, borrados: 0 });
    expect(m.cuerpo.error).toBe("reemplazo_requiere_confirmacion");
  });
  it("404 de resultado: 3 lecturas (getProject + resultado + proyecto)", async () => {
    await sembrarVolver(db);
    expect(await medir(cuerpo({ resultadoId: "rX" }))).toMatchObject({ status: 404, lecturas: 3, escrituras: 1 });
  });
  it("404 de versión y 409 sin_cambios/bloqueado: 5 lecturas, sin escrituras propias", async () => {
    await sembrarVolver(db);
    expect(await medir(cuerpo({ versionId: `${RID}__000099` }))).toMatchObject({ status: 404, lecturas: 5, escrituras: 1 });
    await sembrarVolver(db, { soloEntrega: true, asignaciones: [asig("t1_canal1_primaria_T10", { resultadoId: "otro" })] });
    expect(await medir(cuerpo())).toMatchObject({ status: 409, lecturas: 5, escrituras: 1 });
  });
});

describe("volver confirmado (con historial vigente)", () => {
  /** La pantalla confirma con la huella de la pregunta; la 2.ª llamada es la que se mide. */
  async function medirConfirmando(opciones: Parameters<typeof sembrarVolver>[1] = {}) {
    await sembrarVolver(db, opciones);
    const pregunta = await (await pedir()).json();
    return medir(cuerpo({ confirmarReemplazo: true, huella: pregunta.huella }));
  }
  it("sin tareas afectadas: 7 lecturas (la estimación decía ≈5: +1 por la comprobación previa del archivo y +1 porque el núcleo relee el manifiesto) y 6 escrituras", async () => {
    const m = await medirConfirmando({ asignaciones: [asig("t1_canal1_primaria_T10", { resultadoId: "otro" })] });
    expect(m).toMatchObject({ status: 200, lecturas: 7, escrituras: 6, borrados: 0 });
  });
  it("con 1 tarea reiniciada (primera vez de esa asignación en el historial): 8 escrituras (+ versión previa y nueva de la asignación)", async () => {
    const m = await medirConfirmando();
    expect(m).toMatchObject({ status: 200, lecturas: 7, escrituras: 8 });
  });
  it("con 2 tareas reiniciadas: 10 escrituras (+2 por tarea)", async () => {
    const m = await medirConfirmando({ asignaciones: [asig("t1_canal1_primaria_T10"), asig(ID_LEGADO)] });
    expect(m).toMatchObject({ status: 200, lecturas: 7, escrituras: 10 });
  });
  it("con DERIVA del resultado (cambió sin registro): +1 escritura (la versión de deriva)", async () => {
    const m = await medirConfirmando({ asignaciones: [asig("t1_canal1_primaria_T10", { resultadoId: "otro" })], extraVivo: { compatibilidad: { x: 1 } } });
    expect(m).toMatchObject({ status: 200, lecturas: 7, escrituras: 7 });
  });
  it("huella vencida (la confirmación llega con otra huella): 5 lecturas y NINGUNA escritura propia (+1 de la comprobación previa = 6)", async () => {
    await sembrarVolver(db);
    const m = await medir(cuerpo({ confirmarReemplazo: true, huella: "otra" }));
    expect(m.cuerpo.error).toBe("reemplazo_huella_vencida");
    expect(m).toMatchObject({ lecturas: 6, escrituras: 1 });
  });
  it("nunca borra documentos (poda) con un historial corto", async () => {
    const m = await medirConfirmando();
    expect(m.borrados).toBe(0);
    expect(RESULTADO).toContain(RID);
  });
});
