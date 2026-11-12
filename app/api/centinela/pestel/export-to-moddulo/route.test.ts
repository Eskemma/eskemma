// T8a — export-to-moddulo is retired: always 410, the body is never read, and the counter is written after the
// response (after()). This file started as a characterization of the 6 error codes + 2 successes of HEAD (green there)
// and was EDITED ON PURPOSE: every one of those scenarios now answers 410 and writes nothing to the old collections.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pendientes: Array<() => Promise<void> | void> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void> | void) => { pendientes.push(fn); },
}));
vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __inc: n }), serverTimestamp: () => "TS" },
}));
const tocados: string[] = [];
const set = vi.fn(async (_campos: Record<string, unknown>, _opciones: { merge: boolean }) => {});
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (c: string) => ({ doc: (d: string) => { tocados.push(`${c}/${d}`); return { set, get: vi.fn(), update: vi.fn() }; } }),
  },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
let POST: typeof import("./route").POST;

async function correrPendientes() {
  while (pendientes.length) await pendientes.shift()!();
}
/** A request whose body can never be read: if the route touches it, the test fails. */
function reqSinCuerpoLegible(conCookie = false) {
  const r = new Request("http://local/x", { method: "POST", body: JSON.stringify({ analysisId: "a1", modduloProjectId: "m1" }) }) as never as {
    json: () => never; text: () => never; formData: () => never; arrayBuffer: () => never; cookies: { get: () => unknown };
  };
  const bomba = () => { throw new Error("la ruta leyó el cuerpo"); };
  r.json = bomba; r.text = bomba; r.formData = bomba; r.arrayBuffer = bomba;
  r.cookies = { get: () => (conCookie ? { value: "c" } : undefined) };
  return r as never;
}

let epoca = 0;
beforeEach(async () => {
  vi.resetModules();
  ({ POST } = await import("./route")); // fresh module = fresh throttle state
  epoca += 1;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.now() + 10_000_000 * epoca)); // each test starts outside the throttle window of the previous one
  vi.clearAllMocks();
  pendientes.length = 0;
  tocados.length = 0;
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("export-to-moddulo retirada", () => {
  it("responde 410 con el código estable y el texto de vinculación, sin leer el cuerpo", async () => {
    const r = await POST(reqSinCuerpoLegible(true));
    expect(r.status).toBe(410);
    const j = await r.json();
    expect(j.error).toBe("ruta_retirada");
    expect(j.mensaje).toContain("Esta ruta fue retirada");
    expect(j.mensaje).toContain("Regresar a Moddulo F2 con resultados");
  });

  it("sesión ausente y sesión de otro usuario: 410 y nada se escribe fuera del contador", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(reqSinCuerpoLegible())).status).toBe(410);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "otro" } as never);
    expect((await POST(reqSinCuerpoLegible(true))).status).toBe(410);
    await correrPendientes();
    expect(tocados.every((t) => t === "retiros_rutas/export-to-moddulo")).toBe(true);
    expect(tocados).not.toContain("moddulo_projects/m1");
  });

  it("cuenta con sesión: total +1, sinSesion +0, ultimaLlamada, merge, sin uid ni IP ni cuerpo", async () => {
    await POST(reqSinCuerpoLegible(true));
    await correrPendientes();
    expect(set).toHaveBeenCalledTimes(1);
    const [campos, opciones] = set.mock.calls[0];
    expect(campos).toEqual({ total: { __inc: 1 }, sinSesion: { __inc: 0 }, ultimaLlamada: "TS" });
    expect(opciones).toEqual({ merge: true });
    expect(JSON.stringify(campos)).not.toMatch(/u1|uid|ip/i);
  });

  it("cuenta sin sesión (sin cookie): sinSesion +1", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never); // what the real helper returns without a cookie
    await POST(reqSinCuerpoLegible(false));
    await correrPendientes();
    expect(set.mock.calls[0]).toEqual([{ total: { __inc: 1 }, sinSesion: { __inc: 1 }, ultimaLlamada: "TS" }, { merge: true }]);
  });

  it("[nunca cambia el 410] si el contador falla (contención, red), la respuesta sigue siendo 410", async () => {
    set.mockRejectedValueOnce(Object.assign(new Error("aborted"), { code: 10 }));
    const r = await POST(reqSinCuerpoLegible(true));
    expect(r.status).toBe(410);
    await expect(correrPendientes()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("[nunca cambia el 410] si la verificación de sesión lanza, cuenta como sinSesion y responde 410", async () => {
    vi.mocked(getSessionFromRequest).mockRejectedValue(new Error("firestore caído"));
    expect((await POST(reqSinCuerpoLegible(true))).status).toBe(410);
    await correrPendientes();
    expect(set.mock.calls[0][0]).toMatchObject({ sinSesion: { __inc: 1 } });
  });

  it("la escritura va dentro de after(): al responder todavía no se escribió nada", async () => {
    await POST(reqSinCuerpoLegible(true));
    expect(set).not.toHaveBeenCalled();
    expect(pendientes).toHaveLength(1);
  });

  it("límite: 5 llamadas seguidas escriben una vez; la siguiente después de la ventana lleva lo acumulado", async () => {
    for (let i = 0; i < 5; i++) await POST(reqSinCuerpoLegible(true));
    await correrPendientes();
    expect(set).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 1500));
    await POST(reqSinCuerpoLegible(true));
    await correrPendientes();
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[1][0]).toMatchObject({ total: { __inc: 5 } }); // 4 held + this one
  });
});
