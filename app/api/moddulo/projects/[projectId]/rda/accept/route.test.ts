// H25 (commit 5b) — rda/accept: contrato que la pantalla necesita para no afirmar de más.
// Verifica la regla (e): el `update` es el último paso con efecto; si lanza (la ruta no tiene
// `try`), la excepción sale tal cual y Next responde un 500 SIN código ni cuerpo JSON, que
// guardadoHonesto trata como ambiguo.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
const update = vi.fn();
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({ update }) }) },
}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { POST } from "./route";
import { SIEMBRA_RDA_ID, SIEMBRA_RDA_ITEM } from "@/lib/moddulo/__tests__/fixtures/siembra5b";

const ctx = { params: Promise.resolve({ projectId: "p1" }) };
const req = (itemId: string | undefined = SIEMBRA_RDA_ID) =>
  new Request("http://local/x", { method: "POST", body: JSON.stringify({ itemId }) }) as never;
const conRda = (estado: string) =>
  vi.mocked(getProject).mockResolvedValue({ rda: { [SIEMBRA_RDA_ID]: { ...SIEMBRA_RDA_ITEM, estado } } } as never);

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue(undefined);
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST rda/accept", () => {
  it("acepta un ítem activo sembrado (la muestra de la guía): 200 y UNA escritura", async () => {
    conRda("activo");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0][`rda.${SIEMBRA_RDA_ID}.estado`]).toBe("aceptado");
  });

  it("ítem que ya no está activo (otra pestaña lo aceptó): 400 item_no_activo y cero escrituras", async () => {
    conRda("aceptado");
    const res = await POST(req(), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("item_no_activo");
    expect(update).not.toHaveBeenCalled();
  });

  it("proyecto inexistente o ajeno: 404; sin sesión: 401", async () => {
    vi.mocked(getProject).mockResolvedValue(null as never);
    expect((await POST(req(), ctx)).status).toBe(404);
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("regla (e) — si el update lanza, la excepción sale sin capturar (Next: 500 sin código ni JSON)", async () => {
    conRda("activo");
    update.mockRejectedValueOnce(new Error("commit perdido"));
    await expect(POST(req(), ctx)).rejects.toThrow("commit perdido");
  });
});
