// T8a — a cookie that is PRESENT but invalid or expired counts as `sinSesion` (the real auth helper is used; only the
// session verification and Firestore are mocked). A valid cookie counts as `sinSesion` +0.
import { beforeEach, describe, expect, it, vi } from "vitest";

const pendientes: Array<() => Promise<void> | void> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void> | void) => { pendientes.push(fn); },
}));
const getSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: (c: string) => getSession(c) }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { increment: (n: number) => ({ __inc: n }), serverTimestamp: () => "TS" } }));
const set = vi.fn(async (_c: Record<string, unknown>, _o: { merge: boolean }) => {});
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: () => ({ doc: () => ({ set }) }) } }));

let POST: typeof import("./route").POST;
const conCookie = (valor: string) =>
  ({ json: () => { throw new Error("body"); }, cookies: { get: () => ({ value: valor }) } }) as never;

beforeEach(async () => {
  vi.resetModules();
  ({ POST } = await import("./route"));
  vi.clearAllMocks();
  pendientes.length = 0;
});

describe("export-to-moddulo — cookie presente", () => {
  it("cookie inválida o vencida (verificación falla → session null): 410 y cuenta como sinSesion", async () => {
    getSession.mockResolvedValue({ session: null });
    expect((await POST(conCookie("vencida"))).status).toBe(410);
    while (pendientes.length) await pendientes.shift()!();
    expect(getSession).toHaveBeenCalledWith("vencida"); // the cookie path really ran
    expect(set.mock.calls[0][0]).toEqual({ total: { __inc: 1 }, sinSesion: { __inc: 1 }, ultimaLlamada: "TS" });
  });
  it("cookie válida: 410 y sinSesion +0", async () => {
    getSession.mockResolvedValue({ session: { uid: "u1" } });
    expect((await POST(conCookie("buena"))).status).toBe(410);
    while (pendientes.length) await pendientes.shift()!();
    expect(set.mock.calls[0][0]).toEqual({ total: { __inc: 1 }, sinSesion: { __inc: 0 }, ultimaLlamada: "TS" });
  });
});
