// H-M3 (commit 4) — tareas/sincronizar: con el Reporte F3 (o un veredicto aprobado) no se
// sincroniza el tablero; sin él, el comportamiento no cambia.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-helpers", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/lib/moddulo/project", () => ({ getProject: vi.fn(), attachNumero: (items: unknown[]) => items }));
vi.mock("@/lib/moddulo/f3TareasGenerator", () => ({ generarTareasParaPIPItems: vi.fn(async () => []) }));
vi.mock("@/lib/firebase-admin", () => {
  const update = vi.fn();
  return { adminDb: { collection: () => ({ doc: () => ({ update }) }) }, __update: update };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "TS" } }));

import { getSessionFromRequest } from "@/lib/server/auth-helpers";
import { getProject } from "@/lib/moddulo/project";
import * as admin from "@/lib/firebase-admin";
import { POST } from "./route";

const update = (admin as unknown as { __update: ReturnType<typeof vi.fn> }).__update;
const pip = [{ pipItemId: "p1", numero: 1, pregunta: "¿P1?" }];
const asig = { asignacionId: "a", tipo: "primaria", canal: "canal2", estado: "recibido", activada: true };
const proyecto = (inv: Record<string, unknown>, pipVigente = pip) => ({
  phases: {
    exploracion: { dvs: { pip: pipVigente } },
    investigacion: { f3TareasPIP: [{ pipItemId: "p1", asignaciones: [asig] }, { pipItemId: "p2", asignaciones: [asig] }], pipSnapshotAtGeneration: JSON.stringify([...pip, { pipItemId: "p2", numero: 2, pregunta: "¿P2?" }]), ...inv },
  },
});
const req = () => new Request("http://local/x", { method: "POST", body: JSON.stringify({ projectId: "p1" }) }) as never;
const DIE = { sintesisPorDimension: {}, tableroTareasPIP: [], veredictoHEI: {} };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionFromRequest).mockResolvedValue({ uid: "u1" } as never);
});

describe("POST tareas/sincronizar — bloqueo con el Reporte F3 (H-M3)", () => {
  it("con el Reporte F3: 409 reemplazo_bloqueado, verbo «Sincronizar el tablero», sin «DIE» y sin escribir", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ f3DIE: DIE }) as never);
    const res = await POST(req());
    expect(res.status).toBe(409);
    const b = await res.json();
    expect(b.error).toBe("reemplazo_bloqueado");
    expect(b.mensaje).toContain("Sincronizar el tablero las dejaría inconsistentes");
    expect(b.mensaje).not.toMatch(/\bDIE\b/);
    expect(update).not.toHaveBeenCalled();
  });

  it("veredicto aprobado sin Reporte F3 (anómalo): bloqueado", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ f3Veredicto: { aprobadoPorUsuario: true } }) as never);
    expect((await (await POST(req())).json()).error).toBe("reemplazo_bloqueado");
    expect(update).not.toHaveBeenCalled();
  });

  it("sin Reporte F3 el comportamiento no cambia: sincroniza (retira la tarea de la pregunta eliminada) y escribe", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({}) as never);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.sincronizado).toBe(true);
    expect(b.resumen.eliminadas).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("negativo — antes el bloqueo no existía: con el Reporte F3 sincronizaba y escribía", async () => {
    vi.mocked(getProject).mockResolvedValue(proyecto({ f3DIE: DIE }) as never);
    expect((await POST(req())).status).not.toBe(200);
  });
});
