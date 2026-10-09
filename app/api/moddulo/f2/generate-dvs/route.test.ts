// generate-dvs final: candado de reemplazo (H15 / M8).
//   1. SIN confirmación → 409 ANTES de llamar a Claude (en la ruta «legacy» y en la
//      multi-motor: el pre-chequeo está antes de la bifurcación).
//   2. CON confirmación válida → regenera, copia el dvs anterior a dvsVersiones y escribe.
//   3. El candado se revalida DENTRO de la transacción contra la huella que el usuario
//      confirmó: un cambio en F3 (o un reemplazo concurrente) mientras Claude generaba
//      rechaza la escritura.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/moddulo/project")>();
  return { ...real, getProject: vi.fn() };
});
vi.mock("@/lib/ai/claude", () => ({
  anthropic: { messages: { create: vi.fn() } },
  CLAUDE_MODEL: "modelo-de-prueba",
}));
vi.mock("@/lib/moddulo/knowledge-injector", () => ({ buildPhaseContext: vi.fn(async () => "") }));
vi.mock("@/lib/firebase-admin", async () => {
  const { createMockAdminDb } = await import("@/lib/moddulo/__tests__/fixtures/adminMocks");
  return { adminDb: createMockAdminDb() };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => "FIELD_DELETE" },
}));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { anthropic } from "@/lib/ai/claude";
import { adminDb } from "@/lib/firebase-admin";
import { POST } from "./route";
import type { createMockAdminDb } from "@/lib/moddulo/__tests__/fixtures/adminMocks";

const mockDb = adminDb as unknown as ReturnType<typeof createMockAdminDb>;
const crear = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
const P = "moddulo_projects/p1";

const dvsViejo = {
  hei: { tensionCentral: "vieja", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" },
  contrasteXPCTO: [], semaforo: [], incertidumbres: [],
  pip: [{ pipItemId: "old-1", numero: 1, pregunta: "¿vieja?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
const respuestaClaude = {
  hei: { tensionCentral: "nueva", contexto: "c", condicionesFavorables: [], condicionesAdversas: [], premisaEstrategica: "p" },
  contrasteXPCTO: [], semaforo: [], incertidumbres: [],
  pip: [{ numero: 1, pregunta: "¿nueva?", metodo: "m", vinculoHito: "h", orden: 1, profundidad: "exploratoria" }],
};
const claudeOk = () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(respuestaClaude) }] }) as never;

const asig = (over = {}) => ({ asignacionId: "a", tipo: "primaria", canal: "canal2", justificacion: "", estado: "pendiente", activada: true, ...over });
function docProyecto(extra: { dvs?: unknown; tareas?: unknown[]; die?: unknown; sintesis?: unknown } = {}) {
  return {
    phases: {
      exploracion: { dvs: "dvs" in extra ? extra.dvs : dvsViejo },
      investigacion: {
        f3TareasPIP: extra.tareas ?? [{ pipItemId: "old-1", asignaciones: [asig({ estado: "recibido", resultadoId: "r1" })] }],
        ...(extra.sintesis ? { f3Sintesis: extra.sintesis } : {}),
        ...(extra.die ? { f3DIE: extra.die } : {}),
      },
    },
  };
}
function sembrar(extra = {}, resultados: Record<string, unknown> = { r1: { aprobado: true } }) {
  mockDb.reset({
    [P]: docProyecto(extra),
    ...Object.fromEntries(Object.entries(resultados).map(([id, d]) => [`${P}/f3Resultados/${id}`, d])),
  });
}
function proyectoGetProject(linked = false) {
  vi.mocked(getProject).mockResolvedValue({
    id: "p1", type: "electoral", xpcto: {},
    phases: { exploracion: { ...(linked ? { linkedSource: { payload: { P: { x: 1 } } } } : {}), data: { pestl: { x: 1 } } } },
  } as never);
}
const req = (body: Record<string, unknown>) =>
  new Request("http://local/api/moddulo/f2/generate-dvs", { method: "POST", body: JSON.stringify({ projectId: "p1", ...body }) }) as never;
const versiones = () => Object.entries(mockDb.snapshot()).filter(([p]) => p.startsWith(`${P}/dvsVersiones/`));

async function pedirHuella() {
  const r = await POST(req({ saveas: "final" }));
  expect(r.status).toBe(409);
  const b = await r.json();
  expect(b.error).toBe("reemplazo_requiere_confirmacion");
  return b.huella as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "uOwner" } as never);
  crear.mockImplementation(async () => claudeOk());
  proyectoGetProject();
  sembrar();
});

describe("pre-chequeo (antes de Claude)", () => {
  it("sin confirmación: 409 con impacto y huella, y Claude NO se invoca (ruta legacy)", async () => {
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b).toMatchObject({ error: "reemplazo_requiere_confirmacion", hayImpactoF3: true });
    expect(b.huella).toBeTruthy();
    expect(b.lineas.join(" ")).toContain("«M1 · Tablero de tareas»");
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("K — con linkedSource (camino MULTI-MOTOR) sin confirmación: 409 y Claude no se invoca nunca (el pre-chequeo está antes de la bifurcación)", async () => {
    proyectoGetProject(true);
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_requiere_confirmacion");
    expect(crear).not.toHaveBeenCalled();
  });

  it("omitir `saveas` (default «final») tampoco evita el candado", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(409);
    expect(crear).not.toHaveBeenCalled();
  });

  it("confirmar con una huella equivocada: 409 huella vencida con la huella nueva, sin llamar a Claude", async () => {
    const res = await POST(req({ saveas: "final", confirmar: true, huella: "equivocada" }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_huella_vencida");
    expect(b.huella).not.toBe("equivocada");
    expect(crear).not.toHaveBeenCalled();
  });

  it("con f3DIE: 409 bloqueado con el motivo (sin «DIE») y sin posibilidad de confirmar", async () => {
    sembrar({ die: { tableroTareasPIP: [] } });
    const res = await POST(req({ saveas: "final", confirmar: true, huella: "cualquiera" }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).toContain("«M4 · Veredicto HEI»");
    expect(b.mensaje).toContain("reabrir la Fase 3 aún no está disponible");
    expect(b.mensaje).not.toMatch(/\bDIE\b/);
    expect(crear).not.toHaveBeenCalled();
  });

  it("negativo — el comportamiento anterior regeneraba y sobrescribía sin preguntar", async () => {
    const antes = { status: 200, llamaClaude: true, escribe: true };
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).not.toBe(antes.status);
    expect(crear).not.toHaveBeenCalled();
    expect(mockDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });
});

describe("confirmación válida", () => {
  it("regenera (1 llamada), conserva el dvs anterior en dvsVersiones y escribe el nuevo", async () => {
    const huella = await pedirHuella();
    const res = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(res.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    const v = versiones();
    expect(v).toHaveLength(1);
    expect(v[0][1]).toMatchObject({ dvs: dvsViejo, reemplazadoPor: "uOwner", origen: "generate-dvs-final" });
    const upd = mockDb.updates().find((u) => "phases.exploracion.dvs" in u.data)!;
    expect((upd.data["phases.exploracion.dvs"] as { hei: { tensionCentral: string } }).hei.tensionCentral).toBe("nueva");
  });

  it("sin dvs previo (primera generación): no pide confirmación y no deja copia", async () => {
    sembrar({ dvs: undefined, tareas: [] }, {});
    const res = await POST(req({ saveas: "final" }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
  });

  it("saveas «draft» no tiene candado (solo escribe el borrador)", async () => {
    const res = await POST(req({ saveas: "draft" }));
    expect(res.status).toBe(200);
    expect(versiones()).toHaveLength(0);
    expect(mockDb.updates().some((u) => "phases.exploracion.draftDVS" in u.data)).toBe(true);
    expect(mockDb.updates().some((u) => "phases.exploracion.dvs" in u.data)).toBe(false);
  });
});

describe("revalidación DENTRO de la transacción", () => {
  it("un resultado aprobado mientras Claude generaba: 409 huella vencida y NO se escribe nada", async () => {
    const huella = await pedirHuella();
    crear.mockImplementationOnce(async () => {
      // Otro colaborador aprueba un resultado mientras Claude genera.
      mockDb.reset({
        [P]: docProyecto(),
        [`${P}/f3Resultados/r1`]: { aprobado: true },
        [`${P}/f3Resultados/r2`]: { aprobado: true },
      });
      return claudeOk();
    });
    const res = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_huella_vencida");
    expect(b.huella).not.toBe(huella);
    expect(crear).toHaveBeenCalledTimes(1); // el costo de un 409 tardío
    expect(mockDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });

  it("aparece un DIE mientras Claude generaba: 409 bloqueado y NO se escribe nada", async () => {
    const huella = await pedirHuella();
    crear.mockImplementationOnce(async () => {
      mockDb.reset({ [P]: docProyecto({ die: { x: 1 } }), [`${P}/f3Resultados/r1`]: { aprobado: true } });
      return claudeOk();
    });
    const res = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("reemplazo_bloqueado");
    expect(mockDb.updates()).toHaveLength(0);
  });

  it("J — dos confirmaciones con la misma huella: la primera escribe; la segunda es rechazada dentro de la transacción por el hash del dvs", async () => {
    const huella = await pedirHuella();
    const primera = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(primera.status).toBe(200);
    expect(versiones()).toHaveLength(1);

    // El mock aplica el update con la clave literal, así que se siembra el estado que
    // dejó la primera escritura (dvs nuevo, mismo tablero y resultados).
    const dvsNuevo = { ...dvsViejo, hei: { ...dvsViejo.hei, tensionCentral: "nueva" } };
    const copia = Object.fromEntries(versiones());
    const antesDeLaSegunda = crear.mock.calls.length;
    // La segunda confirmación llegó MIENTRAS la primera generaba: pasó su pre-chequeo con el
    // dvs viejo. Al terminar su generación, la primera ya había escrito el dvs nuevo.
    sembrar();
    crear.mockImplementationOnce(async () => {
      mockDb.reset({ [P]: docProyecto({ dvs: dvsNuevo }), [`${P}/f3Resultados/r1`]: { aprobado: true }, ...copia });
      return claudeOk();
    });
    const segunda = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(segunda.status).toBe(409);
    expect((await segunda.json()).error).toBe("reemplazo_huella_vencida");
    expect(crear.mock.calls.length).toBe(antesDeLaSegunda + 1);
    // Ninguna escritura de la segunda (el registro de updates se reinició con el sembrado
    // que simula la primera) y la única copia es la de la primera.
    expect(versiones()).toHaveLength(1);
    expect(mockDb.updates()).toHaveLength(0);
  });
});

describe("fallos reales", () => {
  it("si la transacción falla: 500 con código «escritura incierta» (no afirma que el anterior sigue intacto)", async () => {
    const huella = await pedirHuella();
    mockDb.runTransaction.mockRejectedValueOnce(new Error("commit perdido"));
    const res = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_escritura_incierta");
    expect(b.mensaje).toContain("Recarga la página para verificar el estado");
    expect(b.mensaje).not.toContain("conserva");
  });

  it("si Claude falla antes de escribir: 500 JSON con motor «legacy», sin ninguna escritura", async () => {
    const huella = await pedirHuella();
    crear.mockRejectedValueOnce(new Error("Claude caído"));
    const res = await POST(req({ saveas: "final", confirmar: true, huella }));
    expect(res.status).toBe(500);
    const b = await res.json();
    expect(b.motor).toBe("legacy");
    expect(b.error).toContain("Claude caído");
    expect(mockDb.updates()).toHaveLength(0);
    expect(versiones()).toHaveLength(0);
  });

  it("sin sesión → 401; proyecto ajeno o inexistente → 404 (antes de cualquier lectura de F3)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValueOnce(null as never);
    expect((await POST(req({ saveas: "final" }))).status).toBe(401);
    vi.mocked(getProject).mockResolvedValueOnce(null as never);
    expect((await POST(req({ saveas: "final" }))).status).toBe(404);
  });
});
