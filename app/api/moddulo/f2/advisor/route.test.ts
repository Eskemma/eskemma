import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/ai/claude", () => ({
  CLAUDE_MODEL: "test-model",
  anthropic: { messages: { create: vi.fn() } },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { POST } from "./route";

const req = () =>
  new Request("http://localhost/api/moddulo/f2/advisor", {
    method: "POST",
    body: JSON.stringify({ projectId: "p1", motor: "politico", campo: "actores" }),
  }) as unknown as Parameters<typeof POST>[0];

const stream = { async *[Symbol.asyncIterator]() {} };

describe("POST /api/moddulo/f2/advisor — territorio estructurado (Paso 4a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
    vi.mocked(anthropic.messages.create).mockResolvedValue(stream as never);
  });

  it("incluye el bloque de territorio del proyecto en el system prompt, antes del motor en edición", async () => {
    vi.mocked(getProject).mockResolvedValue({
      name: "P",
      type: "electoral",
      territorio: { nivel: "distrito_local", nombre: "IZTAPALAPA", estado: "Ciudad de México", distritosSeleccionados: [{ cve: "027", nombre: "IZTAPALAPA", estado: "Ciudad de México" }] },
    } as never);
    await POST(req());
    const system = vi.mocked(anthropic.messages.create).mock.calls[0][0].system as string;
    expect(system).toContain("TERRITORIO DEL PROYECTO");
    expect(system).toContain("D.L. 0927 IZTAPALAPA (Ciudad de México)");
    expect(system.indexOf("TERRITORIO DEL PROYECTO")).toBeLessThan(system.indexOf("MOTOR EN EDICIÓN"));
  });

  it("proyecto legado sin territorio: el prompt no cambia (sin bloque)", async () => {
    vi.mocked(getProject).mockResolvedValue({ name: "P", type: "electoral" } as never);
    await POST(req());
    const system = vi.mocked(anthropic.messages.create).mock.calls[0][0].system as string;
    expect(system).not.toContain("TERRITORIO DEL PROYECTO");
    expect(system).toContain("MOTOR EN EDICIÓN: politico");
  });
});
