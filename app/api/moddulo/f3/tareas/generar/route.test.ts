// Regresión de la extracción de `tareaTieneProgreso`: el guard de «progreso
// existente» de tareas/generar se comporta exactamente igual que antes.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({
  getProject: vi.fn(),
  attachNumero: (items: unknown[]) => items,
}));
vi.mock("@/lib/moddulo/f3TareasGenerator", () => ({ generarTareasParaPIPItems: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => {
  const update = vi.fn();
  return {
    adminDb: {
      collection: () => ({
        doc: () => ({
          update,
          collection: () => ({ get: async () => ({ docs: [{ id: "r1", data: () => ({ aprobado: true }) }] }) }),
        }),
      }),
    },
  };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import { generarTareasParaPIPItems } from "@/lib/moddulo/f3TareasGenerator";
import { POST } from "./route";

const pip = [{ pipItemId: "p1", numero: 1, pregunta: "¿P1?" }, { pipItemId: "p2", numero: 2, pregunta: "¿P2?" }];
const asig = (over: Record<string, unknown> = {}) => ({ asignacionId: "a", tipo: "primaria", canal: "canal2", estado: "pendiente", activada: true, ...over });
const proyecto = (tareas: unknown[]) => ({ phases: { exploracion: { dvs: { pip } }, investigacion: { f3TareasPIP: tareas } } });
const req = (body: unknown) => new Request("http://local/x", { method: "POST", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
  vi.mocked(generarTareasParaPIPItems).mockResolvedValue([]);
});

describe("POST tareas/generar — guard de progreso (regresión)", () => {
  it("con tareas con avance y sin `confirmar`: 409 progreso_existente con el resumen, sin llamar a Claude", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto([
      { pipItemId: "p1", asignaciones: [asig({ estado: "recibido", resultadoId: "r1" })] },
      { pipItemId: "p2", asignaciones: [asig()] },
    ]) as never);
    const res = await POST(req({ projectId: "p1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("progreso_existente");
    expect(body.resumen).toMatchObject({ conResultadoAprobado: 1, desactivadas: 0 });
    expect(body.resumen.tareasAfectadas).toHaveLength(1);
    expect(generarTareasParaPIPItems).not.toHaveBeenCalled();
  });

  it("una vía desactivada a mano también cuenta como progreso", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto([{ pipItemId: "p1", asignaciones: [asig({ activada: false })] }]) as never);
    const res = await POST(req({ projectId: "p1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).resumen.desactivadas).toBe(1);
  });

  it("con `confirmar:true` regenera", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto([{ pipItemId: "p1", asignaciones: [asig({ estado: "recibido" })] }]) as never);
    const res = await POST(req({ projectId: "p1", confirmar: true }));
    expect(res.status).toBe(200);
    expect(generarTareasParaPIPItems).toHaveBeenCalledOnce();
  });

  it("tablero sin avance: regenera sin pedir confirmación", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto([{ pipItemId: "p1", asignaciones: [asig()] }]) as never);
    const res = await POST(req({ projectId: "p1" }));
    expect(res.status).toBe(200);
    expect(generarTareasParaPIPItems).toHaveBeenCalledOnce();
  });
});
